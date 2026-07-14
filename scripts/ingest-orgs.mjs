#!/usr/bin/env node
// NPPES NPI-2 organization ingest (sql/025 nppes_organizations, NYS-41).
//
// Streams the monthly NPPES dissemination CSV on stdin (same pipeline shape as
// ingest-directory.mjs --source=nppes — nothing large touches disk):
//
//   URL=https://download.cms.gov/nppes/NPPES_Data_Dissemination_July_2026_V2.zip
//   curl -sL "$URL" | bsdtar -xOf - '*npidata_pfile*[0-9].csv' \
//     | node --env-file=.env.local scripts/ingest-orgs.mjs --npi-tins=.harvest/npi-tins.txt
//
// Keeps: entity-type-2 records with NY practice location, PLUS any NPI in the
// --npi-tins list regardless of state (the 'npi:'-type TINs observed in
// provider_rate_signals — the national platform-org tail).
//
// Side effect: entity-type-1 records in the --npi-tins list are individuals
// billing under their own NPI — their names go straight to tin_registry
// (source 'nppes-individual', ON CONFLICT DO NOTHING so better names win).
//
// Idempotent: upsert on npi. Safe to re-run monthly.

import { neon } from "@neondatabase/serverless";
import fs from "node:fs";

const sql = neon(process.env.DATABASE_URL);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const arg = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const tinsPath = arg("npi-tins", "");
const wanted = tinsPath
  ? new Set(fs.readFileSync(tinsPath, "utf8").split("\n").map((s) => s.trim()).filter(Boolean))
  : new Set();
console.log(`• nppes NPI-2 orgs — NY practice location + ${wanted.size} npi-TINs (any state); streaming stdin`);

// Fixed NPPES column indices (confirmed against the file header, June 2026 —
// same map as ingest-directory.mjs plus the org-specific columns).
const NP = {
  npi: 0, entity: 1, ein: 3, org: 4, last: 5, first: 6, credential: 10,
  otherOrg: 11,
  addr: 28, city: 30, state: 31, zip: 32, phone: 34,
  enumeration: 36, lastUpdate: 37, deactDate: 39, reactDate: 40,
  aoLast: 42, aoFirst: 43, aoTitle: 45,
  isSubpart: 308, parentLbn: 309,
};
const NP_TAX = [47, 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99, 103];

/** NPPES dates are MM/DD/YYYY → ISO YYYY-MM-DD (or null). */
function npDate(s) {
  const m = (s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

/** Quote-aware CSV parse of one already-delimited record line into fields. */
function parseCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Incremental splitter: buffers a partial tail and yields only complete
 *  records, treating newlines inside quotes as data (bounded memory). */
function makeRecordSplitter() {
  let buf = "";
  return {
    push(chunk) {
      buf += chunk;
      const lines = [];
      let start = 0, q = false;
      for (let i = 0; i < buf.length; i++) {
        const ch = buf[i];
        if (ch === '"') q = !q;
        else if (ch === "\n" && !q) {
          let line = buf.slice(start, i);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          lines.push(line);
          start = i + 1;
        }
      }
      buf = buf.slice(start);
      return lines;
    },
    flush() {
      const l = buf.replace(/\r$/, "");
      buf = "";
      return l ? [l] : [];
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const COLS = [
  "npi", "name", "other_name", "ein", "taxonomy", "address", "city", "state",
  "zip", "phone", "authorized_official", "is_subpart", "parent_lbn",
  "enumeration_date", "last_update", "deactivation_date",
];
const BATCH = 500;
const PAUSE_EVERY = 50; // batches
let scanned = 0, orgs = 0, individuals = 0, batches = 0, headerSkipped = false;
let batch = [];
let tinNames = []; // [tin_norm, business_name] pairs for entity-1 npi-TINs

async function flushBatch() {
  if (!batch.length) return;
  const values = [], params = [];
  let p = 1;
  for (const rec of batch) {
    values.push(`(${COLS.map(() => `$${p++}`).join(",")})`);
    for (const c of COLS) params.push(rec[c] ?? null);
  }
  const set = COLS.slice(1).map((c) => `${c} = EXCLUDED.${c}`).concat("ingested_at = now()").join(", ");
  const text =
    `INSERT INTO nppes_organizations (${COLS.join(",")}) VALUES ${values.join(",")} ` +
    `ON CONFLICT (npi) DO UPDATE SET ${set}`;
  // One connection, sequential. Retry once; a second failure stops the run.
  for (let attempt = 1; ; attempt++) {
    try {
      await sql.query(text, params);
      break;
    } catch (err) {
      if (attempt >= 2) throw new Error(`batch upsert failed twice — stopping: ${err.message}`);
      console.error(`\n  batch error (attempt ${attempt}), retrying once: ${err.message}`);
      await sleep(1500);
    }
  }
  batches++;
  batch = [];
  if (batches % PAUSE_EVERY === 0) await sleep(500); // ease off Neon periodically
}

async function flushTinNames() {
  if (!tinNames.length) return;
  await sql.query(
    `INSERT INTO tin_registry (tin_norm, business_name, source)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
     ON CONFLICT (tin_norm) DO NOTHING`,
    [tinNames.map((t) => t[0]), tinNames.map((t) => t[1]), tinNames.map(() => "nppes-individual")],
  );
  individuals += tinNames.length;
  tinNames = [];
}

async function handleLines(lines) {
  for (const line of lines) {
    if (!headerSkipped) { headerSkipped = true; continue; } // drop the column-name row
    scanned++;
    if (scanned % 100000 === 0)
      process.stdout.write(`\r  scanned ${(scanned / 1e6).toFixed(1)}M, orgs ${orgs}, individual npi-TINs ${individuals + tinNames.length}…`);
    const f = parseCsvLine(line);
    const npi = f[NP.npi];
    const isWanted = wanted.has(npi);
    if (f[NP.entity] === "1") {
      if (!isWanted) continue;
      // Individual billing under their own NPI — name the TIN, done.
      const name = [f[NP.first], f[NP.last]].filter(Boolean).join(" ");
      if (!name) continue;
      const cred = f[NP.credential] ? `, ${f[NP.credential]}` : "";
      tinNames.push([`npi:${npi}`, `${name}${cred} (individual)`]);
      if (tinNames.length >= BATCH) await flushTinNames();
      continue;
    }
    if (f[NP.entity] !== "2") continue; // deactivated stubs have no entity type
    if (!isWanted && f[NP.state] !== "NY") continue;
    const name = f[NP.org];
    if (!name) continue; // deactivated: identity columns are blanked

    // Primary taxonomy: the switch=Y slot, else the first non-empty.
    let primary = null, first = null;
    for (const t of NP_TAX) {
      const code = f[t];
      if (!code) continue;
      first ??= code;
      if (f[t + 3] === "Y") { primary = code; break; }
    }
    const ein = f[NP.ein] && !/UNAVAIL/i.test(f[NP.ein]) ? f[NP.ein] : null;
    const ao = [f[NP.aoLast], f[NP.aoFirst]].filter(Boolean).join(", ");
    batch.push({
      npi,
      name,
      other_name: f[NP.otherOrg] || null,
      ein,
      taxonomy: primary ?? first,
      address: f[NP.addr] || null,
      city: f[NP.city] || null,
      state: f[NP.state] || null,
      zip: (f[NP.zip] || "").slice(0, 5) || null,
      phone: f[NP.phone] || null,
      authorized_official: ao ? (f[NP.aoTitle] ? `${ao} — ${f[NP.aoTitle]}` : ao) : null,
      is_subpart: f[NP.isSubpart] === "Y" ? true : f[NP.isSubpart] === "N" ? false : null,
      parent_lbn: f[NP.parentLbn] || null,
      enumeration_date: npDate(f[NP.enumeration]),
      last_update: npDate(f[NP.lastUpdate]),
      deactivation_date: f[NP.reactDate] ? null : npDate(f[NP.deactDate]),
    });
    orgs++;
    if (batch.length >= BATCH) await flushBatch();
  }
}

const splitter = makeRecordSplitter();
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) {
  await handleLines(splitter.push(chunk));
}
await handleLines(splitter.flush());
await flushBatch();
await flushTinNames();
console.log(`\n✓ nppes orgs: scanned ${scanned} records → ${orgs} orgs upserted, ${individuals} individual npi-TINs named into tin_registry (${batches} batches)`);

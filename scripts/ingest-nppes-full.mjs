#!/usr/bin/env node
// NPPES full-file ingest → sql/030 nppes_npi + nppes_other_names (nationwide,
// both entity types). Streams the monthly dissemination CSV on stdin, same
// shape as ingest-orgs.mjs / ingest-directory.mjs — nothing large touches disk:
//
//   Z=.harvest/nppes/NPPES_Data_Dissemination_July_2026_V2.zip
//   bsdtar -xOf "$Z" 'npidata_pfile_*[0-9].csv' \
//     | node --env-file=.env.local scripts/ingest-nppes-full.mjs --mode=npi
//   bsdtar -xOf "$Z" 'othername_pfile_*[0-9].csv' \
//     | node --env-file=.env.local scripts/ingest-nppes-full.mjs --mode=othername
//
// WHY psql COPY AND NOT THE NEON HTTP DRIVER. This is 8.6M rows. The batched
// INSERT pattern the other loaders use runs ~500 rows per HTTP round trip —
// ~17k round trips, ~2 hours. COPY over the wire protocol loads the same file in
// minutes. The driver stays for everything else; bulk federal files get COPY.
//
// CHUNKING IS NOT OPTIONAL. Neon enforces a ~5-minute per-statement ceiling and
// a single COPY of the whole file is ONE statement. Each chunk below is its own
// COPY (its own statement, ~10-20s), so the ceiling is never in play. Chunk
// boundaries are also the retry unit.
//
// FULL REPLACEMENT SEMANTICS: --mode=npi TRUNCATEs first (this is the monthly
// full file; it IS the truth). Weekly incrementals are a different job — they
// upsert, and live in scripts/nppes-sync.mjs. Re-running this script is safe and
// idempotent; it just redoes the whole load.
//
// Column indices are derived FROM THE HEADER by name, not hardcoded. The V2 file
// changed field lengths in March 2026 and CMS reserves the right to move
// columns; a name-derived map fails loudly on a layout change instead of
// silently loading the wrong column into `sole_proprietor`.

import { spawn } from "node:child_process";

const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const MODE = arg("mode", "npi");
const CHUNK = Number(arg("chunk", "500000"));
if (!["npi", "othername"].includes(MODE)) {
  console.error(`unknown --mode=${MODE} (npi | othername)`);
  process.exit(1);
}

const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

// ── target shape per mode ────────────────────────────────────────────────────
const TARGET = {
  npi: {
    table: "nppes_npi",
    cols: [
      "npi", "entity_type", "org_name", "last_name", "first_name", "credential",
      "loc_addr1", "loc_addr2", "loc_city", "loc_state", "loc_zip", "loc_phone",
      "mail_phone", "sole_proprietor", "primary_taxonomy", "enumeration_date",
      "last_update", "deactivation_date", "reactivation_date",
    ],
    truncate: true,
  },
  othername: {
    table: "nppes_other_names",
    cols: ["npi", "other_name", "type_code"],
    truncate: true,
  },
}[MODE];

// Header names → our columns. Exact strings from the V2 dissemination header.
const H = {
  npi: "NPI",
  entity_type: "Entity Type Code",
  org_name: "Provider Organization Name (Legal Business Name)",
  last_name: "Provider Last Name (Legal Name)",
  first_name: "Provider First Name",
  credential: "Provider Credential Text",
  loc_addr1: "Provider First Line Business Practice Location Address",
  loc_addr2: "Provider Second Line Business Practice Location Address",
  loc_city: "Provider Business Practice Location Address City Name",
  loc_state: "Provider Business Practice Location Address State Name",
  loc_zip: "Provider Business Practice Location Address Postal Code",
  loc_phone: "Provider Business Practice Location Address Telephone Number",
  mail_phone: "Provider Business Mailing Address Telephone Number",
  sole_proprietor: "Is Sole Proprietor",
  enumeration_date: "Provider Enumeration Date",
  last_update: "Last Update Date",
  deactivation_date: "NPI Deactivation Date",
  reactivation_date: "NPI Reactivation Date",
};
const H_OTHER = {
  npi: "NPI",
  other_name: "Provider Other Organization Name",
  type_code: "Provider Other Organization Name Type Code",
};

/** Quote-aware CSV parse of one record line into fields. */
function parseCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** Newline splitter that respects quoted fields spanning no newlines (NPPES has none). */
function lineSplitter() {
  let buf = "";
  return {
    push(chunk) {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      return lines.map((l) => l.replace(/\r$/, ""));
    },
    flush() {
      const l = buf.replace(/\r$/, "");
      buf = "";
      return l ? [l] : [];
    },
  };
}

/** NPPES dates are MM/DD/YYYY → ISO. Empty/garbage → null. */
const npDate = (s) => {
  const m = (s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};

/**
 * One CSV field for psql `COPY ... CSV`. An UNQUOTED empty field is NULL; a
 * QUOTED empty string is ''. We want NULL, so null/'' emit nothing at all.
 */
const csvField = (v) =>
  v === null || v === undefined || v === "" ? "" : `"${String(v).replace(/"/g, '""')}"`;
const csvRow = (vals) => vals.map(csvField).join(",") + "\n";

// ── psql COPY sink ───────────────────────────────────────────────────────────
// One psql per chunk. \copy (not COPY) streams from OUR stdin — server-side COPY
// would look for the file on Neon's disk.
function copyChunk(rows) {
  return new Promise((resolve, reject) => {
    const cmd = `\\copy ${TARGET.table} (${TARGET.cols.join(",")}) FROM STDIN CSV`;
    const ps = spawn("psql", [DB, "-v", "ON_ERROR_STOP=1", "-q", "-c", cmd], {
      stdio: ["pipe", "inherit", "pipe"],
    });
    let err = "";
    ps.stderr.on("data", (d) => (err += d));
    ps.on("error", reject);
    ps.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`psql exit ${code}: ${err.trim()}`)),
    );
    ps.stdin.on("error", (e) => reject(e));
    ps.stdin.end(rows.join(""));
  });
}

async function psqlExec(sqlText) {
  return new Promise((resolve, reject) => {
    const ps = spawn("psql", [DB, "-v", "ON_ERROR_STOP=1", "-q", "-c", sqlText], {
      stdio: ["ignore", "inherit", "pipe"],
    });
    let err = "";
    ps.stderr.on("data", (d) => (err += d));
    ps.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`psql exit ${code}: ${err.trim()}`)),
    );
  });
}

// ── run ──────────────────────────────────────────────────────────────────────
console.log(`• nppes ${MODE} → ${TARGET.table}; chunk=${CHUNK}; streaming stdin`);
if (TARGET.truncate) {
  await psqlExec(`TRUNCATE ${TARGET.table}`);
  console.log(`  truncated ${TARGET.table} (full replacement) [${elapsed()}]`);
}

const splitter = lineSplitter();
let idx = null;          // header name -> position
let taxCols = [];        // [{code, sw}] positions
let scanned = 0, emitted = 0, chunks = 0, skipped = 0, deduped = 0;
let rows = [];

// The Other Name file ships the SAME (npi, name, type) more than once — the
// grain is really (npi, name, type, created_date), and NPI 1548263585 carries
// "Mercy Hospice" type 3 twice (2013 and 2021). We do not keep created_date
// (a name's vintage tells us nothing about which name to display), so those
// rows are pure duplicates and COPY would fail on the primary key. Dedupe here
// rather than widening the key: (npi, name) IS our grain — one name per NPI is
// exactly the question the matcher asks.
// ~1.2M keys, only in othername mode; nppes_npi is keyed by a unique NPI and
// needs no such set (8.6M strings would be real memory).
const seenOther = MODE === "othername" ? new Set() : null;

function buildIndex(headerFields) {
  const pos = new Map(headerFields.map((h, i) => [h.trim(), i]));
  const want = MODE === "npi" ? H : H_OTHER;
  const map = {};
  const missing = [];
  for (const [col, header] of Object.entries(want)) {
    if (!pos.has(header)) missing.push(header);
    else map[col] = pos.get(header);
  }
  if (missing.length) {
    console.error(`FATAL: header missing expected columns:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }
  if (MODE === "npi") {
    for (let n = 1; n <= 15; n++) {
      const c = pos.get(`Healthcare Provider Taxonomy Code_${n}`);
      const s = pos.get(`Healthcare Provider Primary Taxonomy Switch_${n}`);
      if (c !== undefined && s !== undefined) taxCols.push({ code: c, sw: s });
    }
    if (!taxCols.length) {
      console.error("FATAL: no taxonomy code/switch pairs in header");
      process.exit(1);
    }
  }
  return map;
}

/** The taxonomy flagged primary; falls back to the first non-empty code. */
function primaryTaxonomy(f) {
  let first = null;
  for (const { code, sw } of taxCols) {
    const c = f[code];
    if (!c) continue;
    if (!first) first = c;
    if ((f[sw] || "").toUpperCase() === "Y") return c;
  }
  return first;
}

async function flush() {
  if (!rows.length) return;
  const batch = rows;
  rows = [];
  for (let attempt = 1; ; attempt++) {
    try {
      await copyChunk(batch);
      break;
    } catch (e) {
      if (attempt >= 3) throw new Error(`chunk failed 3×, stopping: ${e.message}`);
      console.error(`  chunk error (attempt ${attempt}), retrying: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  chunks++;
  console.log(`  chunk ${chunks}: ${emitted} rows loaded [${elapsed()}]`);
}

async function handleLines(lines) {
  for (const line of lines) {
    if (!line) continue;
    const f = parseCsvLine(line);
    if (!idx) { idx = buildIndex(f); continue; }   // header row
    scanned++;
    const npi = f[idx.npi];
    if (!npi || !/^\d{10}$/.test(npi)) { skipped++; continue; }

    if (MODE === "npi") {
      rows.push(csvRow([
        npi,
        f[idx.entity_type] || null,
        f[idx.org_name] || null,
        f[idx.last_name] || null,
        f[idx.first_name] || null,
        f[idx.credential] || null,
        f[idx.loc_addr1] || null,
        f[idx.loc_addr2] || null,
        f[idx.loc_city] || null,
        f[idx.loc_state] || null,
        f[idx.loc_zip] || null,
        f[idx.loc_phone] || null,
        f[idx.mail_phone] || null,
        f[idx.sole_proprietor] || null,
        primaryTaxonomy(f),
        npDate(f[idx.enumeration_date]),
        npDate(f[idx.last_update]),
        npDate(f[idx.deactivation_date]),
        npDate(f[idx.reactivation_date]),
      ]));
    } else {
      const name = f[idx.other_name];
      if (!name) { skipped++; continue; }
      const key = `${npi}|${name}`;
      if (seenOther.has(key)) { deduped++; continue; }
      seenOther.add(key);
      rows.push(csvRow([npi, name, f[idx.type_code] || null]));
    }
    emitted++;
    if (rows.length >= CHUNK) await flush();
  }
}

for await (const chunk of process.stdin.setEncoding("utf8")) {
  await handleLines(splitter.push(chunk));
}
await handleLines(splitter.flush());
await flush();

console.log(
  `✓ nppes ${MODE}: scanned ${scanned} → ${emitted} loaded, ${skipped} skipped, ` +
    `${deduped} duplicate names dropped, ${chunks} chunks [${elapsed()}]`,
);

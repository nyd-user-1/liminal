#!/usr/bin/env node
// Ingest NY open-data mental-health directory into Neon. Idempotent: upserts
// on (source, source_id). Run against the live DB:
//
//   node --env-file=.env.local scripts/ingest-directory.mjs --source=medicaid
//   node --env-file=.env.local scripts/ingest-directory.mjs --source=omh
//   node --env-file=.env.local scripts/ingest-directory.mjs            (medicaid + omh)
//
// nppes is a streamed FILE source — feed the decompressed CSV on stdin so
// nothing large touches disk (see the ingestNppes block for the full command):
//   curl -sL <monthly NPI zip> | bsdtar -xOf - '*npidata_pfile*[0-9].csv' \
//     | node --env-file=.env.local scripts/ingest-directory.mjs --source=nppes
//
// Sources: medicaid (keti-qx5t, provider-level, ALL NY counties + MH professions),
// omh (6nvr-tbv8, OMH mental-health programs, statewide). nyc (8nqg-ia7v) is
// currently private (HTTP 403) and skipped — see sql/003 header.

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set. Run with: node --env-file=.env.local scripts/ingest-directory.mjs");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const arg = process.argv.find((a) => a.startsWith("--source="));
const only = arg ? arg.split("=")[1] : null;

// Every mental/behavioral-health service category present in the keti-qx5t
// feed (probed statewide). The feed uses broad Medicaid categories, not license
// granularity: "CLINICAL SOCIAL WORKER" covers LCSW/LMSW, "MENTAL HEALTH
// COUNSELORS" = LMHC. Psychiatrists and psychiatric NPs are NOT separable here —
// they fall under generic PHYSICIAN / NURSE PRACTITIONER — so they come from the
// NPPES taxonomy source instead. No CASAC/substance-use or psychoanalyst
// category exists in this feed.
const MH_PROFESSIONS = [
  "CLINICAL SOCIAL WORKER",
  "CLINICAL PSYCHOLOGIST",
  "MENTAL HEALTH COUNSELORS",
  "MARRIAGE & FAMILY THERAPIST",
  "LICENSED BEHAVIOR ANALYST",
  "MENTAL HEALTH REHABILITATION", // ambiguous service category — included (not silently dropped)
];

/** Page through a Socrata resource with an optional $where, 1000/offset. */
async function fetchAll(base, where) {
  const rows = [];
  const limit = 1000;
  for (let offset = 0; ; offset += limit) {
    const url = new URL(base);
    url.searchParams.set("$limit", String(limit));
    url.searchParams.set("$offset", String(offset));
    url.searchParams.set("$order", ":id"); // stable pagination
    if (where) url.searchParams.set("$where", where);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${base} → HTTP ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    process.stdout.write(`\r  fetched ${rows.length}…`);
    if (batch.length < limit) break;
  }
  process.stdout.write("\n");
  return rows;
}

/** Chunked multi-row upsert. cols[0..1] must be ('source','source_id'). */
async function upsert(table, cols, updateCols, records) {
  const CHUNK = 200;
  let n = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const slice = records.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    let p = 1;
    for (const rec of slice) {
      const ph = cols.map(() => `$${p++}`);
      values.push(`(${ph.join(",")})`);
      for (const c of cols) params.push(rec[c] ?? null);
    }
    const setClause = updateCols.map((c) => `${c} = EXCLUDED.${c}`).concat("updated_at = now()").join(", ");
    const text =
      `INSERT INTO ${table} (${cols.join(",")}) VALUES ${values.join(",")} ` +
      `ON CONFLICT (source, source_id) DO UPDATE SET ${setClause}`;
    await sql.query(text, params);
    n += slice.length;
    process.stdout.write(`\r  upserted ${n}/${records.length}…`);
  }
  process.stdout.write("\n");
  return n;
}

async function ingestMedicaid() {
  console.log("• medicaid (keti-qx5t) — ALL NY counties, MH professions");
  console.log(`  inclusion list (${MH_PROFESSIONS.length}): ${MH_PROFESSIONS.join(" · ")}`);
  // Statewide now: the NYC county clip was per the original brief; scope widened
  // to all NY counties. Filter by MH profession only.
  const where = `profession_or_service in(${MH_PROFESSIONS.map((s) => `'${s.replace(/'/g, "''")}'`).join(",")})`;
  const raw = await fetchAll("https://health.data.ny.gov/resource/keti-qx5t.json", where);

  // Dedupe to one card per provider: key by NPI when present, else mmis_id.
  const byKey = new Map();
  for (const r of raw) {
    const key = r.npi || r.mmis_id;
    if (!key || byKey.has(key)) continue;
    byKey.set(key, {
      source: "medicaid",
      source_id: key,
      npi: r.npi ?? null,
      name: r.mmis_name ?? "Unknown provider",
      profession: r.profession_or_service ?? null,
      license_no: null,
      taxonomy: null,
      address: r.service_address ?? null,
      city: r.city ?? null,
      county: r.county ? titleCase(r.county) : null,
      zip: r.zip_code ?? null,
      phone: null,
      raw: JSON.stringify(r),
    });
  }
  const records = [...byKey.values()];
  console.log(`  ${raw.length} rows → ${records.length} distinct providers`);
  const cols = ["source", "source_id", "npi", "name", "profession", "license_no", "taxonomy", "address", "city", "county", "zip", "phone", "raw"];
  const upd = cols.slice(2);
  return upsert("directory_providers", cols, upd, records);
}

async function ingestOmh() {
  console.log("• omh (6nvr-tbv8) — Local Mental Health Programs, statewide");
  const raw = await fetchAll("https://data.ny.gov/resource/6nvr-tbv8.json", null);
  const records = raw.map((r) => ({
    source: "omh",
    source_id: [r.agency_code, r.facility_code, r.program_code].filter(Boolean).join("-") || r.program_code || cryptoKey(r),
    agency: r.agency_name ?? null,
    facility: r.facility_name ?? null,
    program_name: r.program_name ?? "Unnamed program",
    program_type: r.program_type_description ?? null,
    populations: r.populations_served ?? null,
    address: r.program_address_1 ?? null,
    city: r.program_city ?? null,
    county: r.program_county ?? null,
    zip: r.program_zip ?? null,
    phone: r.program_phone ?? r.agency_phone ?? null,
    raw: JSON.stringify(r),
  }));
  // Collapse duplicate source_ids (a few programs repeat) — last wins.
  const byKey = new Map();
  for (const r of records) byKey.set(r.source_id, r);
  const deduped = [...byKey.values()];
  console.log(`  ${raw.length} rows → ${deduped.length} distinct programs`);
  const cols = ["source", "source_id", "agency", "facility", "program_name", "program_type", "populations", "address", "city", "county", "zip", "phone", "raw"];
  const upd = cols.slice(2);
  return upsert("directory_programs", cols, upd, deduped);
}

// ── NPPES (national NPI registry) — statewide, taxonomy-classified ───────────
// Streamed from the monthly data-dissemination FILE (the API caps at 200/query
// and can't do statewide). Invoke as a shell pipeline so nothing large ever
// hits disk — curl | bsdtar decompress to stdout | this reader on stdin:
//
//   URL=https://download.cms.gov/nppes/NPPES_Data_Dissemination_June_2026_V2.zip
//   curl -sL "$URL" | bsdtar -xOf - '*npidata_pfile*[0-9].csv' \
//     | node --env-file=.env.local scripts/ingest-directory.mjs --source=nppes
//
// npidata_pfile is the first zip entry; the '[0-9].csv' glob excludes the
// _fileheader.csv sibling. Column layout is positional/stable (330 cols).

// Fixed NPPES column indices (confirmed against the file header, June 2026).
const NP = { npi: 0, entity: 1, org: 4, last: 5, first: 6, addr: 28, city: 30, state: 31, zip: 32, phone: 34, lic: 48 };
const NP_TAX = [47, 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99, 103]; // the 15 taxonomy code columns

// Mental-health taxonomy include-set, confirmed against NUCC v251. Exact codes
// plus two clean family prefixes (all 103T* are psychologists, all 103G* are
// clinical neuropsychologists). Psychiatry uses the psychiatry-specific 2084
// subcodes only — the neurology/pain/sleep 2084 subcodes are intentionally out.
const MH_TAXONOMY = {
  "2084P0800X": "Psychiatrist", // Psychiatry
  "2084P0804X": "Psychiatrist", // Child & Adolescent Psychiatry
  "2084P0805X": "Psychiatrist", // Geriatric Psychiatry
  "2084P0802X": "Psychiatrist", // Addiction Psychiatry
  "2084F0202X": "Psychiatrist", // Forensic Psychiatry
  "2084P0015X": "Psychiatrist", // Psychosomatic Medicine
  "1041C0700X": "Clinical Social Worker",
  "101YM0800X": "Mental Health Counselor",
  "106H00000X": "Marriage & Family Therapist",
  "102L00000X": "Psychoanalyst",
  "103K00000X": "Behavior Analyst",
  "363LP0808X": "Psychiatric Nurse Practitioner",
};
const MH_TAX_PREFIX = { "103T": "Psychologist", "103G": "Clinical Neuropsychologist" };

function taxLabel(code) {
  if (!code) return null;
  if (MH_TAXONOMY[code]) return MH_TAXONOMY[code];
  for (const pre in MH_TAX_PREFIX) if (code.startsWith(pre)) return MH_TAX_PREFIX[pre];
  return null;
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

async function ingestNppes(input = process.stdin) {
  console.log("• nppes (NPI registry file) — NY practice location, MH taxonomy; streaming stdin");
  console.log(`  taxonomy include-set: ${Object.keys(MH_TAXONOMY).length} exact + prefixes ${Object.keys(MH_TAX_PREFIX).join(", ")}`);

  const cols = ["source", "source_id", "npi", "name", "profession", "license_no", "taxonomy", "address", "city", "county", "zip", "phone"];
  const BATCH = 500;
  const PAUSE_EVERY = 50; // batches
  let scanned = 0, matched = 0, batches = 0, headerSkipped = false;
  let batch = [];

  async function flushBatch() {
    if (!batch.length) return;
    const values = [], params = [];
    let p = 1;
    for (const rec of batch) {
      values.push(`(${cols.map(() => `$${p++}`).join(",")})`);
      for (const c of cols) params.push(rec[c] ?? null);
    }
    const set = cols.slice(2).map((c) => `${c} = EXCLUDED.${c}`).concat("updated_at = now()").join(", ");
    const text =
      `INSERT INTO directory_providers (${cols.join(",")}) VALUES ${values.join(",")} ` +
      `ON CONFLICT (source, source_id) DO UPDATE SET ${set}`;
    if (process.env.DRY_RUN) { batches++; batch = []; return; } // smoke-test: parse only, no writes
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
    if (batches % PAUSE_EVERY === 0) await sleep(800); // ease off Neon periodically
  }

  const splitter = makeRecordSplitter();
  input.setEncoding("utf8");

  async function handleLines(lines) {
    for (const line of lines) {
      if (!headerSkipped) { headerSkipped = true; continue; } // drop the column-name row
      scanned++;
      if (scanned % 10000 === 0) process.stdout.write(`\r  scanned ${scanned}, matched ${matched}…`);
      const f = parseCsvLine(line);
      if (f[NP.state] !== "NY") continue;
      let taxonomy = null, profession = null;
      for (const ti of NP_TAX) {
        const label = taxLabel(f[ti]);
        if (label) { taxonomy = f[ti]; profession = label; break; }
      }
      if (!profession) continue;
      const npi = f[NP.npi];
      if (!npi || !/^\d+$/.test(npi)) continue;
      const name = f[NP.entity] === "2" ? f[NP.org] : `${f[NP.last]} ${f[NP.first]}`.trim();
      matched++;
      if (process.env.DRY_RUN && matched <= 5) {
        console.log(`\n  sample: npi=${npi} | ${f[NP.entity] === "2" ? f[NP.org] : `${f[NP.last]} ${f[NP.first]}`} | ${profession} (${taxonomy}) | ${f[NP.city]}, ${f[NP.state]} ${f[NP.zip]} | lic=${f[NP.lic] || "—"}`);
      }
      batch.push({
        source: "nppes",
        source_id: npi,
        npi,
        name: name || "Unknown provider",
        profession,
        license_no: f[NP.lic] || null,
        taxonomy,
        address: f[NP.addr] || null,
        city: f[NP.city] || null,
        county: null, // NPPES has no county; zip→county backfill is a follow-up
        zip: f[NP.zip] || null,
        phone: f[NP.phone] || null,
      });
      if (batch.length >= BATCH) await flushBatch();
    }
  }

  // Backpressure: pause the stream while a batch upserts.
  for await (const chunk of input) {
    await handleLines(splitter.push(chunk));
  }
  await handleLines(splitter.flush());
  await flushBatch();
  process.stdout.write("\n");
  console.log(`  scanned ${scanned} rows → ${matched} NY mental-health providers upserted (${batches} batches)`);
  return matched;
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
let _k = 0;
function cryptoKey(r) {
  return `row-${_k++}-${(r.program_name || "x").slice(0, 12)}`;
}

const results = {};
// nppes reads a piped CSV stream on stdin, so it's only run when asked for
// explicitly (never as part of the default all-sources run).
if (only === "nppes") {
  results.nppes = await ingestNppes();
} else {
  if (!only || only === "medicaid") results.medicaid = await ingestMedicaid();
  if (!only || only === "omh") results.omh = await ingestOmh();
  if (only === "nyc") console.log("• nyc (8nqg-ia7v) is private (HTTP 403) — skipped.");
}

console.log("\n=== ingest complete ===");
for (const [k, v] of Object.entries(results)) console.log(`  ${k}: ${v} rows upserted`);

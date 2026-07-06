#!/usr/bin/env node
// Ingest NY open-data mental-health directory into Neon. Idempotent: upserts
// on (source, source_id). Run against the live DB:
//
//   node --env-file=.env.local scripts/ingest-directory.mjs --source=medicaid
//   node --env-file=.env.local scripts/ingest-directory.mjs --source=omh
//   node --env-file=.env.local scripts/ingest-directory.mjs            (all)
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

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
let _k = 0;
function cryptoKey(r) {
  return `row-${_k++}-${(r.program_name || "x").slice(0, 12)}`;
}

const results = {};
if (!only || only === "medicaid") results.medicaid = await ingestMedicaid();
if (!only || only === "omh") results.omh = await ingestOmh();
if (only === "nyc") console.log("• nyc (8nqg-ia7v) is private (HTTP 403) — skipped.");

console.log("\n=== ingest complete ===");
for (const [k, v] of Object.entries(results)) console.log(`  ${k}: ${v} rows upserted`);

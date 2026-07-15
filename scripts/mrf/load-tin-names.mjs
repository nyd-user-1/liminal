#!/usr/bin/env node
// Load the tin-name sidecar into tin_registry (sql/019's "tin-name sidecar",
// finally built). Reads the CSV scan-tic.mjs --tin-names= writes:
//
//   node --env-file=.env.local scripts/mrf/load-tin-names.mjs \
//     .harvest/mrf/tin-names/cigna.csv --source=cigna-mrf [--dry-run]
//
// WHY THIS OUTRANKS EVERYTHING ELSE. CMS suppresses EINs in the public NPPES
// file ('<UNAVAIL>'), so an ein-TIN cannot be resolved to an organisation from
// NPPES at all. Every other name we hold for an ein-TIN is therefore an
// inference:
//   nppes-individual  a roster of one -> "it must be that person"  (WRONG for
//                     an employer EIN where only one clinician bills our codes)
//   nppes-org         a roster NPI-2  -> "it must be that org"
//   fhir-crosswalk*   roster overlap  -> "probably that org"
// The MRF business_name is not an inference: it is the payer naming, in its own
// published file, the entity it wrote the contract with. So for ein-TINs this
// OVERWRITES what's there. npi-TINs are untouched — they carry no business_name
// (NPPES resolves them directly) and their existing names are hard facts.

import fs from "node:fs";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const FILE = process.argv[2];
const DRY_RUN = process.argv.includes("--dry-run");
const SOURCE = (process.argv.find((a) => a.startsWith("--source=")) ?? "--source=mrf").slice(9);
if (!FILE || FILE.startsWith("--")) {
  console.error("Usage: load-tin-names.mjs <tin-names.csv> [--source=<slug>] [--dry-run]");
  process.exit(1);
}

// The sidecar CSV is scan-tic's own csv() output: quoted only when needed,
// doubled quotes inside. Carelon publishes unescaped quotes *inside*
// business_name ('TAMELA "TAMMY" ROBY LMFT') — scan-tic already normalises that
// on the way out, so a minimal reader is safe here.
const parseLine = (line) => {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
};

const lines = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean);
if (!lines.length || !lines[0].startsWith("tin,")) {
  console.error(`${FILE}: expected a 'tin,business_name' header`);
  process.exit(1);
}
const pairs = [];
for (const line of lines.slice(1)) {
  const [tin, name] = parseLine(line);
  // business_name is NOT NULL and there are no placeholders: skip anything that
  // isn't a real name rather than writing a lie.
  if (!tin?.startsWith("ein:") || !name || !name.trim()) continue;
  pairs.push([tin.trim(), name.trim()]);
}
console.log(`${FILE}: ${pairs.length} ein-TIN names (source=${SOURCE})`);
if (!pairs.length) process.exit(0);

const wanted = pairs.map((p) => p[0]);
const before = await sql.query(
  `SELECT count(*)::int AS present,
          count(*) FILTER (WHERE source LIKE 'nppes-individual')::int AS was_guessed_as_a_person,
          count(*) FILTER (WHERE source LIKE 'nppes-org' OR source LIKE 'fhir-crosswalk%')::int AS was_inferred_org
   FROM tin_registry WHERE tin_norm = ANY($1)`,
  [wanted],
);
console.log(`  already in registry: ${before[0].present} (${before[0].was_guessed_as_a_person} guessed as a person, ${before[0].was_inferred_org} inferred org)`);

if (DRY_RUN) {
  console.log("--dry-run: no writes");
  const sample = await sql.query(
    `SELECT tin_norm, business_name, source FROM tin_registry WHERE tin_norm = ANY($1) AND source = 'nppes-individual' LIMIT 5`,
    [wanted],
  );
  for (const r of sample) {
    const real = pairs.find((p) => p[0] === r.tin_norm)?.[1];
    console.log(`   ${r.tin_norm}: "${r.business_name}" -> "${real}"`);
  }
  process.exit(0);
}

const CHUNK = 500;
let written = 0;
for (let i = 0; i < pairs.length; i += CHUNK) {
  const c = pairs.slice(i, i + CHUNK);
  const r = await sql.query(
    `INSERT INTO tin_registry (tin_norm, business_name, source)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
     ON CONFLICT (tin_norm) DO UPDATE
       SET business_name = EXCLUDED.business_name,
           source = EXCLUDED.source,
           last_seen = CURRENT_DATE
     RETURNING 1`,
    [c.map((p) => p[0]), c.map((p) => p[1]), c.map(() => SOURCE)],
  );
  written += r.length;
}
console.log(`  upserted ${written} ein-TIN names`);

const after = await sql.query(
  `SELECT count(*) FILTER (WHERE source = $2)::int AS from_this_file FROM tin_registry WHERE tin_norm = ANY($1)`,
  [wanted, SOURCE],
);
console.log(`  now named from ${SOURCE}: ${after[0].from_this_file}`);
console.log("Next: REFRESH MATERIALIZED VIEW CONCURRENTLY rate_table_mv;");

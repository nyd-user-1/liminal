#!/usr/bin/env node
// Extract provider qualifications (degrees / state licenses / specialties) from
// the Plan-Net PractitionerRole `qualification` extensions already stored in
// provider_network_participation.raw_resource (NYS-54). No API calls.
//
//   node --env-file=.env.local scripts/extract-qualifications.mjs [--source=anthem]
//
// Idempotent (ON CONFLICT DO NOTHING). Safe to re-run — re-run after the harvest
// finishes to catch NPIs added since. Qualifications are role-invariant per NPI,
// so we read ONE (latest) raw_resource per NPI, not every row.

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — run with node --env-file=.env.local");
  process.exit(1);
}
const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const SOURCE = arg("source", "anthem");
const NPI_BATCH = 300;
const INS_BATCH = 1000;

const srcRows = await sql`SELECT id FROM payer_sources WHERE slug = ${SOURCE}`;
if (!srcRows[0]) {
  console.error(`No payer_source with slug='${SOURCE}'`);
  process.exit(1);
}
const sourceId = srcRows[0].id;

/** Pull the qualification tuples out of one PractitionerRole raw_resource. */
function parseQuals(raw, npi) {
  const out = [];
  const exts = raw?.extension;
  if (!Array.isArray(exts)) return out;
  for (const e of exts) {
    if (typeof e?.url !== "string" || !e.url.endsWith("/qualification")) continue;
    const sub = e.extension;
    if (!Array.isArray(sub)) continue;
    let typeRaw = null,
      code = "",
      display = "";
    for (const s of sub) {
      if (s?.url === "identifier") typeRaw = s.valueIdentifier?.value ?? null;
      else if (s?.url === "code") {
        const c = s.valueCodeableConcept?.coding?.[0];
        code = c?.code ?? "";
        display = c?.display ?? "";
      }
    }
    if (!code && !display) continue;
    const qual_type = (typeRaw || "other").toLowerCase();
    let license_state = null,
      license_number = null;
    if (qual_type === "license" && display) {
      // 'CA - C155127' | 'NY - 401137' | 'OH - 35.125748' → state + number
      const m = display.match(/^\s*([A-Za-z]{2})\s*[-–—]\s*(.+?)\s*$/);
      if (m) {
        license_state = m[1].toUpperCase();
        license_number = m[2].trim();
      }
    }
    out.push({ npi, qual_type, code, display, license_state, license_number });
  }
  return out;
}

console.log(`• extract-qualifications: source=${SOURCE} — collecting distinct NPIs…`);
const npiRows = await sql`
  SELECT DISTINCT npi FROM provider_network_participation
  WHERE payer_source_id = ${sourceId} AND raw_resource ? 'extension'
`;
const npis = npiRows.map((r) => r.npi);
console.log(`  ${npis.length} distinct NPIs with directory payloads`);

const COLS = ["npi", "qual_type", "code", "display", "license_state", "license_number"];
let pending = [];
let scanned = 0,
  withQuals = 0,
  inserted = 0;

async function flush() {
  if (!pending.length) return;
  const cols = COLS.map((c) => pending.map((r) => r[c]));
  // RETURNING so res.length is the ACTUAL inserted count (neon returns no rows
  // for a plain INSERT, and ON CONFLICT DO NOTHING skips duplicates on re-runs).
  const res = await sql.query(
    `INSERT INTO provider_qualifications (npi, qual_type, code, display, license_state, license_number, source)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
     ON CONFLICT (npi, qual_type, code, display, source) DO NOTHING
     RETURNING id`,
    [...cols, pending.map(() => SOURCE)],
  );
  inserted += res.length ?? 0;
  pending = [];
}

for (let i = 0; i < npis.length; i += NPI_BATCH) {
  const batch = npis.slice(i, i + NPI_BATCH);
  const rows = await sql`
    SELECT DISTINCT ON (npi) npi, raw_resource
    FROM provider_network_participation
    WHERE payer_source_id = ${sourceId} AND npi = ANY(${batch})
    ORDER BY npi, ingested_at DESC
  `;
  for (const r of rows) {
    scanned++;
    const quals = parseQuals(r.raw_resource, r.npi);
    if (quals.length) withQuals++;
    for (const q of quals) {
      pending.push(q);
      if (pending.length >= INS_BATCH) await flush();
    }
  }
  if (i % (NPI_BATCH * 10) === 0) process.stdout.write(`\r  scanned ${scanned}/${npis.length} NPIs, ${inserted} quals…`);
}
await flush();
console.log(`\n✓ ${scanned} NPIs scanned · ${withQuals} carried qualifications · ${inserted} rows inserted`);

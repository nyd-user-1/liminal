#!/usr/bin/env node
// Backfill directory_providers.county for NPPES rows (the NPPES file carries
// city + zip but no county). Primary map: US Census 2020 ZCTA→county crosswalk
// (authoritative, all 62 NY counties), picking the dominant county by land area
// when a ZCTA spans several. Fallback: our own medicaid + omh rows (which have
// zip + county) for the handful of zips Census ZCTAs don't cover.
//
//   node --env-file=.env.local scripts/backfill-nppes-county.mjs
//
// Idempotent: only fills rows where county IS NULL. County spellings are
// normalized to the providers-table convention (e.g. "St. Lawrence" ->
// "St Lawrence") so filters/facets don't split.

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set. Run with: node --env-file=.env.local scripts/backfill-nppes-county.mjs");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const CENSUS = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt";
const zip5 = (z) => (z || "").replace(/[^0-9]/g, "").slice(0, 5);
const normCounty = (c) => c.replace(/\./g, "").trim(); // "St. Lawrence" -> "St Lawrence"

async function buildCensusMap() {
  console.log("• fetching Census ZCTA→county crosswalk…");
  const res = await fetch(CENSUS);
  if (!res.ok) throw new Error(`census → HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  lines.shift(); // header
  const best = new Map(); // zip5 -> { county, area }
  for (const l of lines) {
    if (!l) continue;
    const c = l.split("|");
    const zip = c[1], cfips = c[9], cname = c[10], area = Number(c[16] || 0);
    if (!cfips || !cfips.startsWith("36")) continue; // NY state FIPS = 36
    const county = normCounty(cname.replace(/ County$/, ""));
    const cur = best.get(zip);
    if (!cur || area > cur.area) best.set(zip, { county, area });
  }
  return new Map([...best].map(([z, v]) => [z, v.county]));
}

async function buildInternalMap() {
  // zip5 -> modal county from our statewide rows that already have both.
  const rows = await sql`
    SELECT z, county, count(*)::int n FROM (
      SELECT left(regexp_replace(zip,'[^0-9]','','g'),5) z, county FROM directory_providers WHERE county IS NOT NULL AND zip IS NOT NULL
      UNION ALL
      SELECT left(regexp_replace(zip,'[^0-9]','','g'),5) z, county FROM directory_programs WHERE county IS NOT NULL AND zip IS NOT NULL
    ) s WHERE length(z)=5 GROUP BY z, county`;
  const byZip = new Map(); // zip -> { county, n }
  for (const r of rows) {
    const cur = byZip.get(r.z);
    if (!cur || r.n > cur.n) byZip.set(r.z, { county: r.county, n: r.n });
  }
  return new Map([...byZip].map(([z, v]) => [z, v.county]));
}

const census = await buildCensusMap();
const internal = await buildInternalMap();
console.log(`  census map: ${census.size} zips · internal fallback: ${internal.size} zips`);

// Census primary, internal fills gaps.
const map = new Map(internal);
for (const [z, c] of census) map.set(z, c);

const before = (await sql`SELECT count(*)::int n FROM directory_providers WHERE source='nppes' AND county IS NULL`)[0].n;
const zips = [...map.keys()];
const counties = zips.map((z) => map.get(z));

// One indexed UPDATE join via unnest — a single statement, no per-row churn.
console.log(`• backfilling ${before} null-county nppes rows from ${zips.length} zip mappings…`);
await sql.query(
  `UPDATE directory_providers p
     SET county = m.county, updated_at = now()
     FROM (SELECT unnest($1::text[]) AS zip5, unnest($2::text[]) AS county) m
    WHERE p.source = 'nppes' AND p.county IS NULL
      AND left(regexp_replace(p.zip,'[^0-9]','','g'),5) = m.zip5`,
  [zips, counties],
);

const after = (await sql`SELECT count(*)::int n FROM directory_providers WHERE source='nppes' AND county IS NULL`)[0].n;
console.log(`\n=== county backfill complete ===`);
console.log(`  filled ${before - after} rows; ${after} still null (${(100 * (before - after) / (before || 1)).toFixed(1)}% covered)`);

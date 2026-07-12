#!/usr/bin/env node
// MRF rollup — the morning-report numbers, computed with the hygiene rules:
//  * coverage = DISTINCT NPIs, never raw rows (per-plan/POS duplication
//    inflates rows ~28x; CDPHP alone is ~400 rows/NPI);
//  * medians on deduped rows: DISTINCT (npi, payer, billing_code, rate);
//  * NY plan membership vs BlueCard/other-state reach bucketed by the
//    entity name the FILE declared (never folded together — a national
//    BlueCard row means "reachable while traveling", not "takes Empire").
//
//   node --env-file=.env.local scripts/mrf/rollup.mjs

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

// NY-book entities: named for NY, or NY-market payers we pulled deliberately.
// Everything else (Anthem Colorado, Highmark Delaware, …) = other-state
// entities that surfaced on shared BCBS hosts -> BlueCard/reach bucket.
const NY_ENTITY_RE =
  /new york|of ny|cdphp|oxford|metroplus|carelon|emblem|centene|fidelis|cigna|western new york|empire|excellus/i;

const rows = await sql`
  SELECT payer, count(DISTINCT npi)::int AS npis, count(*)::int AS rows
  FROM provider_rate_signals GROUP BY payer ORDER BY npis DESC`;

const ny = rows.filter((r) => NY_ENTITY_RE.test(r.payer));
const reach = rows.filter((r) => !NY_ENTITY_RE.test(r.payer));

console.log("== NY-book entities (plan-membership signals)");
for (const r of ny) console.log(`  ${String(r.npis).padStart(6)}  ${r.payer}`);
console.log("== Other-state entities (BlueCard/reach signals — never NY membership)");
console.log(`  ${reach.length} entities, ${reach.reduce((a, r) => a + r.npis, 0)} NPI-signals total; top:`);
for (const r of reach.slice(0, 8)) console.log(`  ${String(r.npis).padStart(6)}  ${r.payer}`);

const [tot] = await sql`
  SELECT count(DISTINCT npi)::int AS all_npis, count(*)::int AS all_rows FROM provider_rate_signals`;
const [totNy] = await sql.query(
  `SELECT count(DISTINCT npi)::int AS ny_npis FROM provider_rate_signals WHERE payer ~* $1`,
  [NY_ENTITY_RE.source]
);

const [cov] = await sql.query(
  `WITH rated AS (SELECT DISTINCT npi FROM provider_rate_signals WHERE payer ~* $1),
   listed AS (SELECT DISTINCT npi FROM provider_network_participation)
   SELECT
     (SELECT count(*) FROM rated) AS ny_rated,
     (SELECT count(*) FROM rated r WHERE NOT EXISTS (SELECT 1 FROM listed l WHERE l.npi=r.npi)) AS rate_only`,
  [NY_ENTITY_RE.source]
);

console.log("\n== HEADLINE");
console.log(`NY-book distinct NPIs with a negotiated-rate signal: ${totNy.ny_npis}`);
console.log(`  (all entities incl. reach bucket: ${tot.all_npis}; raw rows ${tot.all_rows} — not a coverage figure)`);
console.log(`NET-NEW: rate signal but NO directory listing under any payer source: ${cov.rate_only}`);

console.log("\n== per-CPT medians (deduped: distinct npi x payer x code x rate; NY book, dollar types)");
const meds = await sql.query(
  `WITH dd AS (
     SELECT DISTINCT npi, payer, billing_code, negotiated_rate
     FROM provider_rate_signals
     WHERE payer ~* $1 AND negotiated_type NOT ILIKE '%percent%'
   )
   SELECT billing_code,
          count(*)::int AS n,
          count(DISTINCT npi)::int AS npis,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2) AS median,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2) AS p25,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2) AS p75
   FROM dd GROUP BY billing_code ORDER BY billing_code`,
  [NY_ENTITY_RE.source]
);
for (const m of meds)
  console.log(
    `  ${m.billing_code}  n=${String(m.n).padStart(7)} npis=${String(m.npis).padStart(6)}  p25=$${m.p25}  median=$${m.median}  p75=$${m.p75}`
  );

console.log("\n== per-payer 90837 median (deduped, NY book) — tier sanity");
const p90837 = await sql.query(
  `WITH dd AS (
     SELECT DISTINCT npi, payer, negotiated_rate
     FROM provider_rate_signals
     WHERE billing_code='90837' AND payer ~* $1 AND negotiated_type NOT ILIKE '%percent%'
   )
   SELECT payer, count(DISTINCT npi)::int AS npis,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2) AS median
   FROM dd GROUP BY payer ORDER BY npis DESC LIMIT 12`,
  [NY_ENTITY_RE.source]
);
for (const p of p90837) console.log(`  $${String(p.median).padStart(8)}  n=${String(p.npis).padStart(6)}  ${p.payer}`);

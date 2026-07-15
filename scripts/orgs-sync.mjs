#!/usr/bin/env node
// Organization-layer sync (sql/025, NYS-41 + NYS-27). Idempotent; run after
// every FHIR harvest or rate load (part of the post-ingest routine):
//
//   node --env-file=.env.local scripts/orgs-sync.mjs [--skip-refresh] [--skip-affiliations]
//
// ⚠️ STEP 1 NO LONGER FITS THE HTTP DRIVER AT ANTHEM SCALE (2026-07-15).
// The neon() HTTP driver goes through Node's fetch, whose undici headersTimeout
// is 300s — a CLIENT limit, not a Neon one. Anthem alone is 1.4M rows × ~2.6KB
// of TOASTed raw_resource, so step 1's JSONB scan blows 300s and dies with
// UND_ERR_HEADERS_TIMEOUT. Chunking per NPI bucket was tried and still exceeded
// it; passing a custom undici dispatcher via fetchOptions does NOT work (Node's
// global fetch uses its own internal undici). Until it's ported to the
// WebSocket Pool (needs `ws`), run step 1 through psql, which has no such
// timeout, then use --skip-affiliations here:
//
//   psql "$DATABASE_URL" -f sql/maint/org-affiliations-sync.sql
//   node --env-file=.env.local scripts/orgs-sync.mjs --skip-affiliations
//
// Three steps, each safe to re-run:
//  1. Extract provider↔org links from provider_network_participation
//     .raw_resource (PractitionerRole.organization) into org_affiliations.
//     Chunked per payer_source — see the ceiling note above.
//  2. Backfill tin_registry names, best source first (ON CONFLICT DO NOTHING
//     = first writer wins, seeds stay):
//       npi-TINs: nppes_organizations (NPI-2 orgs), then directory_providers
//         (individuals billing under their own NPI);
//       ein-TINs: FHIR roster crosswalk — a payer's Organization roster
//         (org_affiliations) vs the TIN's rate-signal roster (org_tin_rosters);
//         overlap ≥ MIN_SHARED NPIs and ≥ MIN_CONTAINMENT of the smaller set,
//         with a clear best-match margin, names the TIN.
//  3. REFRESH the 025 matviews (org_tin_rate_summary, org_tin_rosters).
//     NOTE: 021 + 023 + 024 still refresh separately in the landing routine.

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const SKIP_REFRESH = process.argv.includes("--skip-refresh");
const SKIP_AFFILIATIONS = process.argv.includes("--skip-affiliations");

// Crosswalk acceptance gates — conservative on purpose: a wrong org name on a
// TIN poisons every Know-Your-Rates screen that shows it.
const MIN_SHARED = 10;      // shared NPIs between FHIR org roster and TIN roster
const MIN_CONTAINMENT = 0.6; // shared / min(|org|, |tin|)
const MIN_MARGIN = 2;       // best match must double the runner-up's overlap

const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

// ── 1. FHIR affiliation extraction ──────────────────────────────────────────
const sources = await sql.query(
  "SELECT id, slug, name FROM payer_sources ORDER BY slug",
);
let extracted = 0;
if (SKIP_AFFILIATIONS) {
  console.log("1/3 org_affiliations SKIPPED (--skip-affiliations)");
} else {
  for (const s of sources) {
    const r = await sql.query(
      `INSERT INTO org_affiliations (npi, payer_source_id, org_ref, org_display)
       SELECT DISTINCT p.npi, p.payer_source_id,
              p.raw_resource->'organization'->>'reference',
              p.raw_resource->'organization'->>'display'
       FROM provider_network_participation p
       WHERE p.payer_source_id = $1
         AND p.raw_resource->'organization'->>'reference' IS NOT NULL
         AND p.raw_resource->'organization'->>'display' IS NOT NULL
       ON CONFLICT (npi, payer_source_id, org_ref)
         DO UPDATE SET last_seen = CURRENT_DATE, org_display = EXCLUDED.org_display`,
      [s.id],
    );
    const n = r.length ?? 0;
    if (n) console.log(`  affiliations ${s.slug}: ${n} upserted`);
    extracted += n;
  }
}
console.log(`1/3 org_affiliations synced (${elapsed()})`);

// ── 2a. npi-TIN names ────────────────────────────────────────────────────────
await sql.query(
  `INSERT INTO tin_registry (tin_norm, business_name, source)
   SELECT r.tin, o.name, 'nppes-org'
   FROM (SELECT DISTINCT tin FROM org_tin_rosters WHERE tin LIKE 'npi:%') r
   JOIN nppes_organizations o ON o.npi = substr(r.tin, 5)
   ON CONFLICT (tin_norm) DO NOTHING`,
);
await sql.query(
  `INSERT INTO tin_registry (tin_norm, business_name, source)
   SELECT r.tin, min(d.name) || ' (individual)', 'directory'
   FROM (SELECT DISTINCT tin FROM org_tin_rosters WHERE tin LIKE 'npi:%') r
   JOIN directory_providers d ON d.npi = substr(r.tin, 5)
   GROUP BY r.tin
   ON CONFLICT (tin_norm) DO NOTHING`,
);

// ── 2b. ein-TIN names via the FHIR roster crosswalk ─────────────────────────
// Overlaps computed here, not in SQL — the pair space is sparse (each NPI
// carries 1-3 org refs and 1-5 TINs) so hashing per-NPI beats any array join.
const aff = await sql.query(
  `SELECT npi, payer_source_id || '|' || org_ref AS org_key, min(org_display) AS display
   FROM org_affiliations GROUP BY npi, payer_source_id || '|' || org_ref`,
);
const tinRoster = await sql.query(
  `SELECT tin, npi FROM org_tin_rosters WHERE tin LIKE 'ein:%'`,
);
const orgRosterSize = new Map(); // org_key -> size
const orgDisplay = new Map();
const npiOrgs = new Map(); // npi -> org_key[]
for (const a of aff) {
  orgRosterSize.set(a.org_key, (orgRosterSize.get(a.org_key) ?? 0) + 1);
  orgDisplay.set(a.org_key, a.display);
  let l = npiOrgs.get(a.npi);
  if (!l) npiOrgs.set(a.npi, (l = []));
  l.push(a.org_key);
}
const tinSize = new Map();
const overlap = new Map(); // org_key -> Map(tin -> shared)
for (const r of tinRoster) {
  tinSize.set(r.tin, (tinSize.get(r.tin) ?? 0) + 1);
  const orgs = npiOrgs.get(r.npi);
  if (!orgs) continue;
  for (const k of orgs) {
    let m = overlap.get(k);
    if (!m) overlap.set(k, (m = new Map()));
    m.set(r.tin, (m.get(r.tin) ?? 0) + 1);
  }
}
const proposals = [];
for (const [orgKey, tins] of overlap) {
  const ranked = [...tins.entries()].sort((a, b) => b[1] - a[1]);
  const [tin, shared] = ranked[0];
  const runnerUp = ranked[1]?.[1] ?? 0;
  const containment = shared / Math.min(orgRosterSize.get(orgKey), tinSize.get(tin));
  if (shared >= MIN_SHARED && containment >= MIN_CONTAINMENT && shared >= runnerUp * MIN_MARGIN) {
    proposals.push({ tin, name: orgDisplay.get(orgKey), shared, containment, orgKey });
  }
}
// One TIN can win several FHIR orgs (payer-local refs for the same group) —
// keep the strongest name per TIN.
const byTin = new Map();
for (const p of proposals) {
  const cur = byTin.get(p.tin);
  if (!cur || p.shared > cur.shared) byTin.set(p.tin, p);
}
const accepted = [...byTin.values()];
if (accepted.length) {
  const CHUNK = 500;
  for (let i = 0; i < accepted.length; i += CHUNK) {
    const c = accepted.slice(i, i + CHUNK);
    await sql.query(
      `INSERT INTO tin_registry (tin_norm, business_name, source)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
       ON CONFLICT (tin_norm) DO NOTHING`,
      [c.map((p) => p.tin), c.map((p) => p.name), c.map((p) => `fhir-crosswalk:${p.orgKey.split("|")[0].slice(0, 8)}`)],
    );
  }
  const top = accepted.sort((a, b) => b.shared - a.shared).slice(0, 12);
  console.log("  top crosswalk names:");
  for (const p of top)
    console.log(`    ${p.tin} ← "${p.name}" (${p.shared} shared, ${(p.containment * 100).toFixed(0)}% containment)`);
}
const named = await sql.query(
  `SELECT (SELECT count(*) FROM tin_registry) AS names,
          (SELECT count(DISTINCT tin) FROM org_tin_rosters) AS tins`,
);
console.log(
  `2/3 tin_registry backfilled: ${accepted.length} ein-TINs named via crosswalk; ` +
  `${named[0].names}/${named[0].tins} TINs named overall (${elapsed()})`,
);

// ── 3. refresh the 025 matviews ──────────────────────────────────────────────
if (!SKIP_REFRESH) {
  await sql.query("REFRESH MATERIALIZED VIEW CONCURRENTLY org_tin_rate_summary");
  await sql.query("REFRESH MATERIALIZED VIEW CONCURRENTLY org_tin_rosters");
  console.log(`3/3 org matviews refreshed (${elapsed()})`);
} else {
  console.log("3/3 refresh skipped (--skip-refresh)");
}

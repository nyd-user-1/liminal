#!/usr/bin/env node
// TIN display-name backfill (NYS / published-rates). Idempotent; run as part of
// the post-ingest routine, after orgs-sync.mjs and before REFRESH rate_table_mv
// (sql/027 reads display_name from tin_registry):
//
//   node --env-file=.env.local scripts/backfill-tin-names.mjs [--dry-run]
//
// orgs-sync.mjs already names npi-TINs (nppes_organizations / directory_providers)
// and the ein-TINs whose rate roster overlaps a payer's FHIR Organization roster.
// That crosswalk needs >=10 shared NPIs, so it can't reach a solo practice — and
// solo practices ARE the long tail: ~77% of the TINs on the five published-rates
// codes rendered unnamed. This resolves the rest from the TIN's own roster:
//
//  * single-NPI TIN -> that NPI's directory_providers name + ' (individual)'
//    (same shape orgs-sync uses for its directory branch). If the lone NPI is an
//    NPI-2 instead (present in nppes_organizations) it's an org shell, not a
//    person: take the org name. Org-first matches orgs-sync's own precedence.
//  * multi-NPI TIN -> the nppes_organizations name of a roster NPI-2; when the
//    roster holds several, the one with the most rate_rows (the billing anchor).
//  * multi-NPI TIN with NO NPI-2 -> SKIP. Naming a group practice after one of
//    its members is worse than leaving it unnamed; the UI renders those as
//    "Unnamed practice · N clinicians" and they stay searchable by TIN/NPI.
//
// business_name is NOT NULL and there are no placeholder names: a TIN either
// resolves to a real name or keeps its row out of the registry. Every INSERT is
// ON CONFLICT (tin_norm) DO NOTHING — first writer wins, seeds and the better
// FHIR-crosswalk names survive a re-run.

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");

const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

// The five published-rates codes, and the payers whose books actually resolve to
// single rates (sql/027's allowlist — keep in sync).
const CODES = ["90791", "90834", "90837", "90853", "99214"];
const PAYERS = [
  "Cigna Health & Life",
  "Empire BlueCross BlueShield",
  "Oxford Health Insurance Inc",
  "EmblemHealth (Carelon behavioral)",
  "Fidelis Care (Centene)",
  "MetroPlus Health Plan",
];

// ── coverage baseline ────────────────────────────────────────────────────────
// One fact-table scan (~20s), reused for the before AND after reading: pull the
// TIN universe once, then intersect against tin_registry keys in JS. Re-scanning
// provider_rate_signals just to re-count would double the cost for no new fact.
const universe = await sql.query(
  `SELECT DISTINCT tin, bool_or(payer = ANY($2)) AS allowlist
   FROM provider_rate_signals
   WHERE billing_code = ANY($1)
     AND lower(billing_class) = 'professional'
     AND negotiated_type NOT ILIKE '%percent%'
     AND negotiated_rate > 5
     AND payer NOT ILIKE 'Aetna%'
   GROUP BY tin`,
  [CODES, PAYERS],
);
const allTins = universe.map((r) => r.tin);
const allowTins = universe.filter((r) => r.allowlist).map((r) => r.tin);
console.log(
  `baseline: ${allTins.length} non-Aetna TINs on the five codes ` +
    `(${allowTins.length} on the sql/027 payer allowlist) [${elapsed()}]`,
);

const namedKeys = async () => {
  const rows = await sql.query("SELECT tin_norm FROM tin_registry");
  return new Set(rows.map((r) => r.tin_norm));
};
const coverage = (keys) => ({
  all: allTins.filter((t) => keys.has(t)).length,
  allow: allowTins.filter((t) => keys.has(t)).length,
});

const before = coverage(await namedKeys());
console.log(
  `BEFORE: ${before.all}/${allTins.length} non-Aetna named (${pct(before.all, allTins.length)}) · ` +
    `${before.allow}/${allowTins.length} allowlist named (${pct(before.allow, allowTins.length)})`,
);

if (DRY_RUN) {
  console.log("--dry-run: no writes");
  process.exit(0);
}

// ── canonical directory row per NPI ──────────────────────────────────────────
// directory_providers holds ~123k rows for ~106k NPIs (an NPI can appear once
// from the 'nppes' load and once from 'medicaid'). Only 'nppes' rows carry a
// credential, so coalesce the best available value per NPI rather than picking
// one row and inheriting its NULLs. min(name) matches orgs-sync's tie-break.
const DIR_CANON = `
  SELECT npi,
         min(name) AS name,
         (array_agg(credential ORDER BY (credential IS NULL), (source = 'nppes') DESC))[1] AS credential
  FROM directory_providers
  WHERE npi IS NOT NULL AND name IS NOT NULL
  GROUP BY npi`;

// ── 1. single-NPI TINs whose lone NPI is an NPI-2 org ────────────────────────
const r1 = await sql.query(
  `INSERT INTO tin_registry (tin_norm, business_name, source)
   SELECT s.tin, o.name, 'nppes-org'
   FROM (SELECT tin, min(npi) AS npi FROM org_tin_rosters GROUP BY tin HAVING count(*) = 1) s
   JOIN nppes_organizations o ON o.npi = s.npi
   ON CONFLICT (tin_norm) DO NOTHING
   RETURNING 1`,
);
console.log(`1/3 single-NPI org shells named: ${r1.length} [${elapsed()}]`);

// ── 2. single-NPI TINs -> the person ─────────────────────────────────────────
// Runs after (1), so an org shell keeps its org name via ON CONFLICT.
const r2 = await sql.query(
  `INSERT INTO tin_registry (tin_norm, business_name, source)
   SELECT s.tin, d.name || ' (individual)', 'nppes-individual'
   FROM (SELECT tin, min(npi) AS npi FROM org_tin_rosters GROUP BY tin HAVING count(*) = 1) s
   JOIN (${DIR_CANON}) d ON d.npi = s.npi
   ON CONFLICT (tin_norm) DO NOTHING
   RETURNING 1`,
);
console.log(`2/3 solo practices named: ${r2.length} [${elapsed()}]`);

// ── 3. multi-NPI TINs -> the roster's anchor NPI-2 ───────────────────────────
// DISTINCT ON picks the NPI-2 with the most rate_rows; ties break on npi so a
// re-run is deterministic. TINs with no NPI-2 on the roster fall out of the JOIN.
const r3 = await sql.query(
  `INSERT INTO tin_registry (tin_norm, business_name, source)
   SELECT DISTINCT ON (t.tin) t.tin, o.name, 'nppes-org'
   FROM org_tin_rosters t
   JOIN nppes_organizations o ON o.npi = t.npi
   WHERE t.tin IN (SELECT tin FROM org_tin_rosters GROUP BY tin HAVING count(*) > 1)
   ORDER BY t.tin, t.rate_rows DESC, t.npi
   ON CONFLICT (tin_norm) DO NOTHING
   RETURNING 1`,
);
console.log(`3/3 group practices named from a roster NPI-2: ${r3.length} [${elapsed()}]`);

// ── after ────────────────────────────────────────────────────────────────────
const after = coverage(await namedKeys());
console.log(
  `AFTER:  ${after.all}/${allTins.length} non-Aetna named (${pct(after.all, allTins.length)}) · ` +
    `${after.allow}/${allowTins.length} allowlist named (${pct(after.allow, allowTins.length)})`,
);
console.log(
  `gain: +${after.all - before.all} non-Aetna, +${after.allow - before.allow} allowlist ` +
    `(${pct(before.allow, allowTins.length)} -> ${pct(after.allow, allowTins.length)}) [${elapsed()}]`,
);
if (after.allow / allowTins.length <= 0.5)
  console.warn("WARNING: allowlist coverage still <=50% — do not refresh rate_table_mv yet");

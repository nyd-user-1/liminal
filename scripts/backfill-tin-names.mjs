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

// ── 0. npi-IDENTIFIED TINs: the identifier itself names the entity ───────────
// A payer may identify a billing group by an NPI instead of an EIN, and that
// NPI is frequently the GROUP's own NPI-2 — not any member's. Empire does this
// for 100% of its rows. So for every 'npi:' TIN, the identifier is the first
// and best evidence of who the entity is: resolve it against
// nppes_organizations BEFORE looking at the roster.
//
// Getting this order wrong is not cosmetic. npi:1629049192 is MEMORIAL
// GASTROENTEROLOGY GROUP; the only member in our data is one clinician, so a
// roster-first rule names the GROUP after that person and types it as an
// individual. That is a false statement about a real organisation, on a page
// whose whole value is that every row is checkable.
//
// orgs-sync.mjs has this same rule and runs earlier, but ON CONFLICT DO NOTHING
// means whoever writes first wins — so if it hasn't run since the last load,
// step 2 below would claim the row. Repair first, then insert.
const repaired = await sql.query(
  `UPDATE tin_registry g
   SET business_name = o.name, source = 'nppes-org', last_seen = CURRENT_DATE
   FROM nppes_organizations o
   WHERE g.tin_norm LIKE 'npi:%'
     AND o.npi = substr(g.tin_norm, 5)
     AND g.source = 'nppes-individual'
   RETURNING 1`,
);
console.log(`0/5 npi-identified orgs repaired (were named after a member): ${repaired.length} [${elapsed()}]`);

const r0 = await sql.query(
  `INSERT INTO tin_registry (tin_norm, business_name, source)
   SELECT DISTINCT r.tin, o.name, 'nppes-org'
   FROM (SELECT DISTINCT tin FROM org_tin_rosters WHERE tin LIKE 'npi:%') r
   JOIN nppes_organizations o ON o.npi = substr(r.tin, 5)
   ON CONFLICT (tin_norm) DO NOTHING
   RETURNING 1`,
);
console.log(`1/5 npi-identified orgs named from the identifier: ${r0.length} [${elapsed()}]`);

// ── 1b. single-NPI TINs whose lone ROSTER NPI is an NPI-2 org ────────────────
const r1 = await sql.query(
  `INSERT INTO tin_registry (tin_norm, business_name, source)
   SELECT s.tin, o.name, 'nppes-org'
   FROM (SELECT tin, min(npi) AS npi FROM org_tin_rosters GROUP BY tin HAVING count(*) = 1) s
   JOIN nppes_organizations o ON o.npi = s.npi
   ON CONFLICT (tin_norm) DO NOTHING
   RETURNING 1`,
);
console.log(`2/5 single-NPI org shells named: ${r1.length} [${elapsed()}]`);

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
console.log(`3/5 solo practices named: ${r2.length} [${elapsed()}]`);

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
console.log(`4/5 group practices named from a roster NPI-2: ${r3.length} [${elapsed()}]`);

// ── 4. relaxed FHIR roster crosswalk (last resort) ───────────────────────────
// Same maths as orgs-sync's crosswalk, one notch looser: >=5 shared NPIs rather
// than >=10, containment and margin unchanged. Runs LAST so an NPPES legal name
// (steps 1-3) always beats a payer-roster attestation, and orgs-sync's stricter
// pass — which runs earlier in the routine — keeps its own names via ON CONFLICT.
//
// Why not looser still: the gates are what stop a wrong name landing on a TIN,
// and a wrong org name poisons every screen that shows it. Measured on the 2,789
// TINs still unnamed for /published-rates (2026-07-14):
//   shared>=10 (orgs-sync's bar)  ->    15    shared>=3, 50%, 1.5x ->   185
//   shared>=5  (this pass)        ->    56    shared>=1, no gate   -> 1,858
// That last row is the trap: it would name a 693-clinician TIN off ONE shared
// NPI. The real fix is upstream — the MRF provider_references carry
// business_name inside the tin object and scan-tic.mjs currently drops it
// (sql/019's "tin-name sidecar, pending"). This pass is a stopgap, not that.
const MIN_SHARED = 5;
const MIN_CONTAINMENT = 0.6;
const MIN_MARGIN = 2;

const unnamedTins = new Set(
  (await sql.query(
    `SELECT DISTINCT t.tin FROM org_tin_rosters t
     WHERE NOT EXISTS (SELECT 1 FROM tin_registry g WHERE g.tin_norm = t.tin)`,
  )).map((r) => r.tin),
);
const aff = await sql.query(
  `SELECT npi, payer_source_id || '|' || org_ref AS org_key, min(org_display) AS display
   FROM org_affiliations GROUP BY npi, payer_source_id || '|' || org_ref`,
);
const roster = await sql.query(`SELECT tin, npi FROM org_tin_rosters`);

const orgSize = new Map(), orgDisplay = new Map(), npiOrgs = new Map();
for (const a of aff) {
  orgSize.set(a.org_key, (orgSize.get(a.org_key) ?? 0) + 1);
  orgDisplay.set(a.org_key, a.display);
  let l = npiOrgs.get(a.npi);
  if (!l) npiOrgs.set(a.npi, (l = []));
  l.push(a.org_key);
}
// tinSize counts the FULL roster (not just unnamed TINs) — containment divides
// by the smaller of the two rosters, so an undercounted denominator would
// inflate it and wave through weak matches.
const tinSize = new Map(), cands = new Map();
for (const r of roster) {
  tinSize.set(r.tin, (tinSize.get(r.tin) ?? 0) + 1);
  if (!unnamedTins.has(r.tin)) continue;
  for (const k of npiOrgs.get(r.npi) ?? []) {
    let m = cands.get(r.tin);
    if (!m) cands.set(r.tin, (m = new Map()));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
}
const accepted = [];
for (const [tin, orgs] of cands) {
  const ranked = [...orgs.entries()].sort((a, b) => b[1] - a[1]);
  const [orgKey, shared] = ranked[0];
  const runnerUp = ranked[1]?.[1] ?? 0;
  const containment = shared / Math.min(orgSize.get(orgKey), tinSize.get(tin));
  if (shared >= MIN_SHARED && containment >= MIN_CONTAINMENT && shared >= runnerUp * MIN_MARGIN)
    accepted.push({ tin, name: orgDisplay.get(orgKey), src: orgKey.split("|")[0].slice(0, 8) });
}
for (let i = 0; i < accepted.length; i += 500) {
  const c = accepted.slice(i, i + 500);
  await sql.query(
    `INSERT INTO tin_registry (tin_norm, business_name, source)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
     ON CONFLICT (tin_norm) DO NOTHING`,
    [c.map((p) => p.tin), c.map((p) => p.name), c.map((p) => `fhir-crosswalk5:${p.src}`)],
  );
}
console.log(`5/5 named via relaxed FHIR crosswalk (>=${MIN_SHARED} shared): ${accepted.length} [${elapsed()}]`);

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

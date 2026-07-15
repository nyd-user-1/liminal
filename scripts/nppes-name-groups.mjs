#!/usr/bin/env node
// Name the unnamed billing groups on /published-rates from the full NPPES file
// (sql/030 nppes_npi). Runs entirely in SQL — no NPPES API, no heuristics in JS:
//
//   node --env-file=.env.local scripts/nppes-name-groups.mjs [--dry-run]
//
// Slots into the post-ingest routine AFTER backfill-tin-names.mjs and BEFORE
// REFRESH rate_table_mv (sql/027 reads business_name from tin_registry).
//
// ── THE ROUTE, AND WHY IT IS THIS AND NOT SOMETHING SIMPLER ─────────────────
// The unnamed tail is ein-type TINs: the payer published an EIN, and NPPES
// suppresses EINs (0 of 8.6M rows carry one — CMS blanks the field). So EIN->name
// is impossible by lookup. What we do have is the group's ROSTER of practitioner
// NPIs. Each practitioner publishes their own practice location. The organization
// billing for them generally sits at that same desk with its own NPI-2. So:
//
//   roster NPI -> its NPPES practice location (address + phone)
//              -> the NPI-2 at that same address whose phone also matches
//              -> that organization's name is the group's name
//
// Every gate below is a measured response to a real false match, not caution for
// its own sake:
//
//  * ADDRESS ALONE IS UNSAFE. 300 LONGWOOD AVE returns BCH Dental Group, Boston
//    Brace, 3x BCH Connected Care and 4x BOSTON CHILDREN'S HOSPITAL. An unnamed
//    roster is also geographically scattered (one EIN spans Boston, Brighton,
//    Rochester and Cooperstown) and address-only matching previously named it
//    after U of R Psychiatry and Bassett Healthcare — both wrong. Phone is the
//    tiebreak that separates co-located organizations.
//  * PHONE MUST CHECK BOTH NUMBERS. MCCD PSYCHIATRY SERVICES PLLC (Talkiatry's
//    billing entity) publishes location tel 917-634-5311 and mailing tel
//    833-351-8255; the practitioner at that desk publishes 833-351-8255 as his
//    LOCATION phone. Location-to-location only would reject the true match.
//  * SUITE DESIGNATORS DIFFER ACROSS RECORDS. '109 W 27TH ST STE 5S' vs
//    '109 W 27TH ST # 5S' — same desk, different string. sql/030's addr_key
//    normalizes both sides identically; see that file's header.
//  * EXACTLY ONE NAME, OR SKIP. If a TIN's roster resolves to two different
//    organization names, we do not vote, rank, or prefer the bigger one — we
//    leave it unnamed. The page's entire value is that every row is checkable;
//    a plausible wrong name is worse than "Unnamed practice", which is honest
//    and still searchable by identifier and NPI.
//
// Several NPI-2s sharing ONE name (BCH's four subpart NPIs) is NOT ambiguity —
// count(DISTINCT name) = 1 and the group is named. Ambiguity is two different
// names, and only that.
//
// Display name prefers the Other Name file's DBA (type 3) over the Legal
// Business Name: the legal entity behind a practice is routinely an opaque
// holding name, and the DBA is what a patient would recognize.

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

const coverage = async () =>
  (await sql.query(
    `SELECT count(*)::int AS rows, count(display_name)::int AS named,
            count(*) FILTER (WHERE display_name IS NULL AND tin LIKE 'ein:%')::int AS un_ein,
            count(*) FILTER (WHERE display_name IS NULL AND tin LIKE 'npi:%')::int AS un_npi
     FROM rate_table_mv`,
  ))[0];

const before = await coverage();
console.log(
  `BEFORE (rate_table_mv, pre-refresh): ${before.named}/${before.rows} named ` +
    `(${pct(before.named, before.rows)}) · unnamed ein ${before.un_ein} / npi ${before.un_npi}`,
);

// The display name for an organization NPI-2: its DBA if it published one, else
// its legal business name. Kept as one expression so both passes agree.
const ORG_NAME = `COALESCE(
  (SELECT x.other_name FROM nppes_other_names x
    WHERE x.npi = o.npi AND x.type_code = '3'
    ORDER BY x.other_name LIMIT 1),
  o.org_name)`;

// Ambiguity is counted on the name's SHAPE, not its spelling. Boston Children's
// four NPI-2s publish "Boston Children's Hospital" and "BOSTON CHILDRENS
// HOSPITAL" — one name, two spellings, and counting the raw strings would call
// that a conflict and throw away a name we are certain of. Same idea as
// sql/030's addr_key: normalize both sides, then compare.
//
// This is deliberately ONLY case and punctuation. It does not stem, fuzzy-match
// or cluster: "FRANCISCAN HOSPITAL FOR CHILDREN" and "FRANCISCAN PEDIATRICS,
// INC." stay two names and that TIN still skips. Worth 15 of 2,050 TINs —
// small, but they are names we would otherwise have discarded as false
// conflicts, and the alternative (a similarity threshold) is exactly the kind
// of guessing this whole route refuses.
const NAME_KEY = (expr) => `regexp_replace(upper(${expr}), '[^A-Z0-9]', '', 'g')`;

// ── the impossible-biller gate ───────────────────────────────────────────────
// An address tells you where someone WORKS, not who BILLS for them, and that is
// this route's one real failure mode. NPI 1013387513 practices at 1797 DUTCH
// BROADWAY, ELMONT — which is a CVS store, matching on address AND phone. Her
// EIN got named "CVS PHARMACY". The one-name gate cannot catch this: only one
// roster member resolved, so there was no second opinion to disagree with it.
//
// The check that does catch it comes from the row's own meaning. Every rate on
// this page is a PROFESSIONAL behavioural-health code (90791/90834/90837/90853/
// 99214). A pharmacy cannot bill 90837. Neither can a hearing-aid supplier or
// an ambulance company. So when the only organization at a practitioner's desk
// is one of those, it is not the entity the payer is paying — that is a
// contradiction with what the row IS, not a judgement call about likelihood.
//
// NUCC groupings 33x (Suppliers: pharmacies, DME, prosthetics, blood banks) and
// 34x (Transportation: ambulance, medical transport), verified against the file:
// 262,412 org NPIs, zero of them capable of billing a psychotherapy code.
// Everything a behavioural group could actually be — 10x practitioners, 25x
// agencies, 26x clinics, 27x/28x hospitals, 36x nurse practitioners — is
// untouched.
//
// Excluding these as CANDIDATES (not just as winners) also un-blocks real
// matches: a practice sharing a building with a pharmacy used to look
// ambiguous, and now resolves.
//
// NOT applied to the npi-identified pass below: there the payer itself names
// the entity by NPI, which is an attestation, not an inference from geography.
// If a payer says it pays a pharmacy's NPI, that is a fact about the contract.
const PLAUSIBLE_BILLER = `o.primary_taxonomy IS NOT NULL
  AND o.primary_taxonomy NOT LIKE '33%'
  AND o.primary_taxonomy NOT LIKE '34%'`;

if (DRY_RUN) {
  // Same match, no writes: report what WOULD land, plus what gets skipped and why.
  const preview = await sql.query(`
    WITH target AS (
      SELECT DISTINCT tin FROM rate_table_mv WHERE display_name IS NULL AND tin LIKE 'ein:%'
    ), member AS (
      SELECT t.tin, n.addr_key, n.zip5, n.loc_phone_key
      FROM target t
      JOIN org_tin_rosters r ON r.tin = t.tin
      JOIN nppes_npi n ON n.npi = r.npi
      WHERE n.deactivation_date IS NULL
        AND n.addr_key <> '' AND n.zip5 <> '' AND n.loc_phone_key <> ''
    ), cand AS (
      SELECT m.tin, ${ORG_NAME} AS name
      FROM member m
      JOIN nppes_npi o
        ON o.entity_type = 2 AND o.deactivation_date IS NULL
       AND o.zip5 = m.zip5 AND o.addr_key = m.addr_key
       AND (o.loc_phone_key = m.loc_phone_key OR o.mail_phone_key = m.loc_phone_key)
      WHERE ${ORG_NAME} IS NOT NULL AND ${PLAUSIBLE_BILLER}
    ), resolved AS (
      SELECT tin, count(DISTINCT ${NAME_KEY("name")})::int AS n_names FROM cand GROUP BY tin
    )
    SELECT (SELECT count(*) FROM target)::int AS target_tins,
           (SELECT count(*) FROM resolved)::int AS tins_with_candidate,
           (SELECT count(*) FROM resolved WHERE n_names = 1)::int AS would_name,
           (SELECT count(*) FROM resolved WHERE n_names > 1)::int AS skipped_ambiguous`);
  console.log("--dry-run:", JSON.stringify(preview[0]), `[${elapsed()}]`);
  process.exit(0);
}

// ── 1. npi-identified TINs: the identifier names the entity ──────────────────
// These were unnamed only because sql/025's nppes_organizations is NY-scoped —
// an out-of-state organization simply was not in our data. The full file has it.
// An NPI-1 identifier means the payer named the group by a person's own NPI:
// that person IS the billing entity, and ' (individual)' matches the existing
// convention in orgs-sync.mjs / backfill-tin-names.mjs.
const r1 = await sql.query(`
  INSERT INTO tin_registry (tin_norm, business_name, source)
  SELECT DISTINCT ON (t.tin) t.tin,
         CASE WHEN o.entity_type = 2 THEN ${ORG_NAME}
              ELSE nullif(trim(coalesce(o.first_name,'') || ' ' || coalesce(o.last_name,'')), '')
                   || ' (individual)' END,
         'nppes-full-npi'
  FROM (SELECT DISTINCT tin FROM rate_table_mv WHERE display_name IS NULL AND tin LIKE 'npi:%') t
  JOIN nppes_npi o ON o.npi = substr(t.tin, 5)
  WHERE o.deactivation_date IS NULL
    AND COALESCE(${ORG_NAME}, nullif(trim(coalesce(o.first_name,'') || ' ' || coalesce(o.last_name,'')), '')) IS NOT NULL
  ORDER BY t.tin
  ON CONFLICT (tin_norm) DO NOTHING
  RETURNING 1`);
console.log(`1/2 npi-identified TINs named from the full file: ${r1.length} [${elapsed()}]`);

// ── 2. ein-identified groups: the co-located organization ────────────────────
const r2 = await sql.query(`
  WITH target AS (
    SELECT DISTINCT tin FROM rate_table_mv WHERE display_name IS NULL AND tin LIKE 'ein:%'
  ), member AS (
    -- Each roster practitioner's own practice location. Blank keys can't match
    -- anything (and '' = '' would match everything) so they are dropped here.
    SELECT t.tin, n.addr_key, n.zip5, n.loc_phone_key
    FROM target t
    JOIN org_tin_rosters r ON r.tin = t.tin
    JOIN nppes_npi n ON n.npi = r.npi
    WHERE n.deactivation_date IS NULL
      AND n.addr_key <> '' AND n.zip5 <> '' AND n.loc_phone_key <> ''
  ), cand AS (
    SELECT m.tin, ${ORG_NAME} AS name
    FROM member m
    JOIN nppes_npi o
      ON o.entity_type = 2 AND o.deactivation_date IS NULL
     AND o.zip5 = m.zip5 AND o.addr_key = m.addr_key
     AND (o.loc_phone_key = m.loc_phone_key OR o.mail_phone_key = m.loc_phone_key)
    WHERE ${ORG_NAME} IS NOT NULL AND ${PLAUSIBLE_BILLER}
  ), resolved AS (
    SELECT tin, min(name) AS name
    FROM cand GROUP BY tin
    -- The whole gate: one name or nothing. min() only chooses a SPELLING here
    -- (the shapes are already known identical), never between two entities.
    HAVING count(DISTINCT ${NAME_KEY("name")}) = 1
  )
  INSERT INTO tin_registry (tin_norm, business_name, source)
  SELECT tin, name, 'nppes-full-colocated' FROM resolved
  ON CONFLICT (tin_norm) DO NOTHING
  RETURNING 1`);
console.log(`2/2 ein groups named via co-located NPI-2 (address+phone): ${r2.length} [${elapsed()}]`);

console.log(
  `\n+${r1.length + r2.length} names written to tin_registry. ` +
    `REFRESH MATERIALIZED VIEW CONCURRENTLY rate_table_mv to see them. [${elapsed()}]`,
);

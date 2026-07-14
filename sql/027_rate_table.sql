-- Liminal — 027: rate_table_mv (the published-rates table, /published-rates).
--
-- Grain: one row per (tin, payer) — what a single insurer publishes it pays one
-- billing entity in New York for the five behavioral-health codes. The page
-- ships the WHOLE corpus for a payer (~12.5k rows for Cigna) and narrows it
-- client-side, so this MV is the entire query layer: no per-row lookups, no
-- filters pushed to request time beyond `WHERE payer = $1`.
--
-- REFRESH ORDER — this MV reads tin_registry, so it must refresh AFTER the
-- names land or ~77% of the table renders "Unnamed practice". It appends to the
-- existing post-ingest routine:
--
--   REFRESH MATERIALIZED VIEW CONCURRENTLY provider_rate_summary;            -- 021
--   REFRESH MATERIALIZED VIEW CONCURRENTLY provider_participation_summary;   -- 023
--   REFRESH MATERIALIZED VIEW CONCURRENTLY rate_bands_*;                     -- 024
--   node --env-file=.env.local scripts/orgs-sync.mjs                         -- 025 MVs + names
--   node --env-file=.env.local scripts/backfill-tin-names.mjs                -- roster-derived names
--   REFRESH MATERIALIZED VIEW CONCURRENTLY rate_table_mv;                    -- 027 (this file)
--   ANALYZE;
--
-- orgs-sync.mjs refreshes org_tin_rosters, which this MV joins for roster size /
-- entity kind / NPI search — so 027 refreshes after orgs-sync, not before.
--
-- Build cost ~5-10s (the filtered fact scan is ~4s); well inside Neon's 5-minute
-- per-statement ceiling, so no chunked CREATE TABLE AS needed.
--
-- Query constraints below are NOT optional — each one was measured against live
-- data (2026-07-14) and each silently corrupts the table if dropped:
--  * lower(billing_class) = 'professional' — the column is case-inconsistent
--    ('Professional' vs 'professional'); naive equality drops half the data.
--  * negotiated_type NOT ILIKE '%percent%' — percentage-of-billed-charge rows
--    are not dollar rates. Every other MV in this DB applies this filter.
--  * negotiated_rate > 5 — noise floor.
--  * The payer ALLOWLIST (not a blocklist). Excluded on purpose: both Aetna
--    labels (7.9M of 9.3M rows, ~3,100 distinct 90837 rates, ~4% single-rate
--    resolution — they'd render an almost entirely empty table), UnitedHealthcare
--    of NY (5.6%), Oxford Health Plans (CT) (7.2%), CDPHP (0.0%), out-of-state
--    Blues, Excellus (5 rows). Adding a payer here means proving its single-rate
--    share first.
--  * A TIN shows a rate for a code ONLY if that (tin, payer, code) resolves to
--    exactly ONE distinct value. Multi-rate cells stay NULL and render "—";
--    picking one arbitrarily would invent a fact the payer never published.

-- ── rate_table_mv ────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS rate_table_mv AS
WITH cells AS (
  -- (tin, payer, code) -> the single published rate, or NULL when the entity
  -- carries several rates for that code under the same book.
  SELECT tin, payer, billing_code,
         CASE WHEN count(DISTINCT negotiated_rate) = 1 THEN min(negotiated_rate) END AS rate,
         max(file_date) AS last_file_date
  FROM provider_rate_signals
  WHERE payer = ANY (ARRAY[
          'Cigna Health & Life',
          'Empire BlueCross BlueShield',
          'Oxford Health Insurance Inc',
          'EmblemHealth (Carelon behavioral)',
          'Fidelis Care (Centene)',
          'MetroPlus Health Plan'
        ])
    AND billing_code IN ('90791', '90834', '90837', '90853', '99214')
    AND lower(billing_class) = 'professional'
    AND negotiated_type NOT ILIKE '%percent%'
    AND negotiated_rate > 5
  GROUP BY tin, payer, billing_code
), pivot AS (
  -- Five codes -> five columns. cells holds exactly one row per group, so the
  -- FILTERed max() is just "that row's rate" (NULL stays NULL).
  SELECT tin, payer,
         max(rate) FILTER (WHERE billing_code = '90791')::numeric(10,2) AS c90791,
         max(rate) FILTER (WHERE billing_code = '90834')::numeric(10,2) AS c90834,
         max(rate) FILTER (WHERE billing_code = '90837')::numeric(10,2) AS c90837,
         max(rate) FILTER (WHERE billing_code = '90853')::numeric(10,2) AS c90853,
         max(rate) FILTER (WHERE billing_code = '99214')::numeric(10,2) AS c99214,
         -- The payer's PUBLICATION date (file_date), not provider_rate_signals'
         -- own as_of — as_of is when we scanned the file and reads ~today for
         -- every payer, which would render MetroPlus's Feb-2024 book as fresh.
         max(last_file_date) AS as_of
  FROM cells
  GROUP BY tin, payer
), roster AS (
  -- org_tin_rosters is the ready-made tin->npi join (31,233 TINs / 150,499 rows).
  -- NEVER resolve rosters off provider_rate_signals directly — the correlated
  -- version blows the 5-minute statement ceiling.
  SELECT t.tin,
         count(*)::int AS n_clinicians,
         -- Platform TINs (Headway et al.) carry thousands of NPIs; shipping them
         -- would balloon the page payload for a client-side search nobody runs
         -- on a 13k-clinician roster. Small rosters only.
         CASE WHEN count(*) <= 25 THEN array_agg(t.npi ORDER BY t.npi) ELSE '{}'::text[] END AS npis,
         -- Non-NULL only for a true solo practice, so the LEFT JOIN below hands
         -- individual-only attributes to individuals and NULL to everyone else.
         CASE WHEN count(*) = 1 AND NOT bool_or(o.npi IS NOT NULL) THEN min(t.npi) END AS solo_npi,
         CASE WHEN count(*) = 1 AND NOT bool_or(o.npi IS NOT NULL)
              THEN 'individual' ELSE 'organization' END AS entity_kind
  FROM org_tin_rosters t
  LEFT JOIN nppes_organizations o ON o.npi = t.npi   -- presence here = NPI-2 org
  GROUP BY t.tin
), dir AS (
  -- ~123k rows for ~106k NPIs: an NPI can land once from the 'nppes' load and
  -- once from 'medicaid'. Only 'nppes' rows carry a credential and only
  -- 'medicaid' rows are authoritative on profession, so coalesce the best
  -- available value per field instead of picking one row and inheriting its NULLs.
  SELECT npi,
         (array_agg(credential       ORDER BY (credential IS NULL),       (source = 'nppes') DESC))[1]   AS credential,
         (array_agg(profession       ORDER BY (profession IS NULL),       (source = 'medicaid') DESC))[1] AS profession,
         (array_agg(primary_taxonomy ORDER BY (primary_taxonomy IS NULL), (source = 'nppes') DESC))[1]   AS primary_taxonomy,
         (array_agg(county           ORDER BY (county IS NULL),           (source = 'nppes') DESC))[1]   AS county
  FROM directory_providers
  WHERE npi IS NOT NULL
  GROUP BY npi
)
SELECT p.tin,
       p.payer,
       reg.business_name AS display_name,        -- NULL allowed; UI renders "Unnamed practice"
       COALESCE(r.entity_kind, 'organization') AS entity_kind,
       -- Individual-only: a group's clinicians have many credentials, so a
       -- single credential on an org row would be a lie. d.* is already NULL for
       -- orgs (solo_npi is NULL -> no join match).
       d.credential,
       -- Raw credential is unnormalized in directory_providers ('MD' 3,715 vs
       -- 'M.D.' 3,742; 'PHD'/'PH.D.'/'PH.D'; 'LCSW'/'L.C.S.W.'). Strip periods,
       -- spaces and hyphens, uppercase — this is what the filter chips group on.
       -- Keep the raw value too: it's what the provider recognizes.
       upper(regexp_replace(d.credential, '[.[:space:]-]', '', 'g')) AS credential_norm,
       d.profession,
       d.primary_taxonomy,
       d.county,
       COALESCE(r.npis, '{}'::text[]) AS npis,
       COALESCE(r.n_clinicians, 0) AS n_clinicians,
       p.c90791, p.c90834, p.c90837, p.c90853, p.c99214,
       p.as_of
FROM pivot p
LEFT JOIN roster r      ON r.tin = p.tin
LEFT JOIN dir d         ON d.npi = r.solo_npi
LEFT JOIN tin_registry reg ON reg.tin_norm = p.tin;

-- REFRESH ... CONCURRENTLY requires a unique index; (payer, tin) is the grain
-- and also the page's access path (`WHERE payer = $1`).
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_table_mv_key ON rate_table_mv (payer, tin);
-- Credential filtering is the page's most-used control.
CREATE INDEX IF NOT EXISTS idx_rate_table_mv_cred ON rate_table_mv (payer, credential_norm);
-- No trigram index: name/TIN/NPI search runs client-side over the loaded rows.

COMMENT ON MATERIALIZED VIEW rate_table_mv IS
  'One row per (billing TIN, payer): the single published professional rate per behavioral-health code, for the six NY payers whose books actually resolve to single rates. as_of = payer file_date (publication), not scan date. Refresh AFTER orgs-sync.mjs + backfill-tin-names.mjs — see sql/027 header.';

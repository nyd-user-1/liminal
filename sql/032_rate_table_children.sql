-- Liminal — 032: rate_table_child_mv — the clinicians inside a billing group.
--
-- WHAT THIS FIXES. sql/027 is one row per (billing group, insurer). That row is
-- the contract, and it is the right spine — but it was the ONLY thing we kept.
-- The payer does not publish a rate for a group; it publishes a rate for a
-- PERSON, under a group. sql/027's `GROUP BY tin, payer, billing_code` collapsed
-- the people out, then reported the resulting collisions as "multi-rate" and
-- rendered "—". So the page deleted, cell by cell, the exact thing it exists to
-- show: that this insurer pays these five colleagues five different numbers for
-- the same hour.
--
-- This MV is sql/027 one level down: (billing group, insurer, NPI). Same codes,
-- same columns, same filters — the parent row is a group header, these are its
-- children. Together they make the comparison work at two depths with one
-- gesture: BETWEEN practices (parent rows) and WITHIN a practice (open one).
--
-- Concretely, NPI 1326429036 (Jessica Becker, MD, child psychiatry) is in three
-- groups, and Cigna pays her 90837 at $167.83 through one and $1,183.00 through
-- another. Same doctor, same code, same insurer, same network. The only variable
-- is whose identifier is on the claim. sql/027 alone cannot render that fact;
-- this MV is where it lives.
--
-- ── WHY 2..25 CLINICIANS ────────────────────────────────────────────────────
-- Not a performance hedge — a payload one. Measured 2026-07-15:
--   solo (1 clinician)     28,991 rows — the parent IS the clinician; a child
--                                       row would be the same row twice.
--   small groups (2..25)    8,661 rows ->  47,891 children  <- this MV
--   platforms (>25)         1,064 rows -> 168,030 children  <- excluded
-- Those 1,064 platform TINs (Headway carries ~13.6k NPIs) hold 3.5x the children
-- of every real practice combined, and nobody reads a 13,614-row roster. Same
-- cap, and the same reasoning, as sql/027's `npis` array. /orgs is where a
-- platform's roster belongs.
--
-- ── REFRESH ────────────────────────────────────────────────────────────────
-- Reads org_tin_rosters (025) for the size gate, so it refreshes with 027:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY rate_table_mv;         -- 027
--   REFRESH MATERIALIZED VIEW CONCURRENTLY rate_table_child_mv;   -- 032 (this)
-- Every filter below is copied from sql/027 ON PURPOSE and must stay identical —
-- a child whose filters differ from its parent's is a child that does not add up
-- to it. See the sql/027 header for why each one is load-bearing.

CREATE MATERIALIZED VIEW IF NOT EXISTS rate_table_child_mv AS
WITH eligible AS (
  -- The size gate, computed once off the ready-made roster MV.
  SELECT tin FROM org_tin_rosters GROUP BY tin HAVING count(*) BETWEEN 2 AND 25
), cells AS (
  -- (tin, payer, npi, code) -> that CLINICIAN's single published rate, or NULL
  -- with n_rates > 1 when the payer published several for them. 82% of these
  -- cells resolve to exactly one rate (vs 45.5% at the group grain) — the
  -- collapse was never noise, it was five people.
  SELECT s.tin, s.payer, s.npi, s.billing_code,
         CASE WHEN count(DISTINCT s.negotiated_rate) = 1 THEN min(s.negotiated_rate) END AS rate,
         count(DISTINCT s.negotiated_rate)::int AS n_rates,
         max(s.file_date) AS last_file_date
  FROM provider_rate_signals s
  JOIN eligible e ON e.tin = s.tin
  WHERE s.payer = ANY (ARRAY[
          'Cigna Health & Life',
          'Empire BlueCross BlueShield',
          'Oxford Health Insurance Inc',
          'EmblemHealth (Carelon behavioral)',
          'Fidelis Care (Centene)',
          'MetroPlus Health Plan'
        ])
    AND s.billing_code IN ('90791', '90834', '90837', '90853', '99214')
    AND lower(s.billing_class) = 'professional'
    AND s.negotiated_type NOT ILIKE '%percent%'
    AND s.negotiated_rate > 5
  GROUP BY s.tin, s.payer, s.npi, s.billing_code
), pivot AS (
  SELECT tin, payer, npi,
         max(rate) FILTER (WHERE billing_code = '90791')::numeric(10,2) AS c90791,
         max(rate) FILTER (WHERE billing_code = '90834')::numeric(10,2) AS c90834,
         max(rate) FILTER (WHERE billing_code = '90837')::numeric(10,2) AS c90837,
         max(rate) FILTER (WHERE billing_code = '90853')::numeric(10,2) AS c90853,
         max(rate) FILTER (WHERE billing_code = '99214')::numeric(10,2) AS c99214,
         COALESCE(max(n_rates) FILTER (WHERE billing_code = '90791'), 0) AS n90791,
         COALESCE(max(n_rates) FILTER (WHERE billing_code = '90834'), 0) AS n90834,
         COALESCE(max(n_rates) FILTER (WHERE billing_code = '90837'), 0) AS n90837,
         COALESCE(max(n_rates) FILTER (WHERE billing_code = '90853'), 0) AS n90853,
         COALESCE(max(n_rates) FILTER (WHERE billing_code = '99214'), 0) AS n99214,
         max(last_file_date) AS as_of
  FROM cells
  GROUP BY tin, payer, npi
), dir AS (
  -- Identical to sql/027's dir CTE: an NPI can land once from the 'nppes' load
  -- and once from 'medicaid'; only 'nppes' rows carry a credential and only
  -- 'medicaid' rows are authoritative on profession, so coalesce the best value
  -- per field rather than picking one row and inheriting its NULLs.
  SELECT npi,
         (array_agg(name       ORDER BY (name IS NULL)))[1]                              AS name,
         (array_agg(credential ORDER BY (credential IS NULL), (source = 'nppes') DESC))[1]   AS credential,
         (array_agg(profession ORDER BY (profession IS NULL), (source = 'medicaid') DESC))[1] AS profession,
         (array_agg(city       ORDER BY (city IS NULL),       (source = 'nppes') DESC))[1]   AS city,
         (array_agg(county     ORDER BY (county IS NULL),     (source = 'nppes') DESC))[1]   AS county
  FROM directory_providers
  WHERE npi IS NOT NULL
  GROUP BY npi
)
SELECT p.tin,
       p.payer,
       p.npi,
       -- The child's own name. NULL is fine and expected for an NPI we hold no
       -- directory row for; the UI falls back to the NPI, which is never NULL.
       d.name AS display_name,
       d.credential,
       upper(regexp_replace(d.credential, '[.[:space:]-]', '', 'g')) AS credential_norm,
       d.profession,
       d.city,
       d.county,
       p.c90791, p.c90834, p.c90837, p.c90853, p.c99214,
       p.n90791, p.n90834, p.n90837, p.n90853, p.n99214,
       p.as_of
FROM pivot p
LEFT JOIN dir d ON d.npi = p.npi;

-- (payer, tin, npi) is the grain and the access path: the page reads one
-- payer's children, then attaches them to parents by tin.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_table_child_key
  ON rate_table_child_mv (payer, tin, npi);

COMMENT ON MATERIALIZED VIEW rate_table_child_mv IS
  'The clinicians inside a billing group: one row per (billing TIN, payer, NPI) for groups of 2-25. Children of sql/027 rate_table_mv — same codes, same filters, one level down. Solo groups are excluded (the parent IS the clinician); platform TINs >25 are excluded (payload — see /orgs).';

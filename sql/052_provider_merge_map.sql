-- sql/052_provider_merge_map.sql  —  NYS-34 person-level merge (REVERSIBLE)
--
-- WHY ------------------------------------------------------------------------
-- directory_providers stores the same person as up to two rows — one 'medicaid'
-- and one 'nppes' — keyed by a shared NPI (the table's unique key is
-- (source, source_id), so a person can appear once per source). 16,934 NPIs
-- appear in BOTH sources; that overlap inflates the raw row count (123,592)
-- above the true person count (106,658). Measured 2026-07-18, live DB.
--
-- REVERSIBLE BY CONSTRUCTION -------------------------------------------------
-- Nothing here UPDATEs or DELETEs directory_providers. The map only RECORDS
-- which row survives and which is absorbed; surfaces consult the map (or the
-- directory_persons view below). Escape hatch: DELETE the map rows (or a single
-- rule tier) and every original row renders exactly as before — no data lost.
--
-- SURVIVOR = the nppes row. On the overlap set the medicaid row carries only
-- name + county + address; license_no / primary_taxonomy / credential /
-- entity_type / medicaid_id are ALL 0-of-16,934. The nppes row is populated on
-- every axis (taxonomy 16,934, entity_type 16,934, license 14,607, gender
-- 16,892). This supersedes the medicaid-preference in lib/repos/directory.ts:257
-- whose stated rationale ("medicaid carries license + Medicaid participation")
-- does not hold: NO medicaid row in this table has a license_no or medicaid_id.
-- (Caveat for a future field-coalesced view: the medicaid row often has the
-- fuller NAME string — "DIAMOND ROBERT D" vs nppes "DIAMOND ROBERT".)
--
-- INERT: no repo consumes this table or view yet. Wiring surfaces onto
-- directory_persons (the "surface flip") is a separate, founder-gated follow-up.

CREATE TABLE IF NOT EXISTS provider_merge_map (
  merged_id    uuid PRIMARY KEY REFERENCES directory_providers(id) ON DELETE CASCADE,
  surviving_id uuid NOT NULL   REFERENCES directory_providers(id) ON DELETE CASCADE,
  npi          text,
  rule         text NOT NULL,        -- 'npi_name_match' | 'npi_name_divergent'
  confidence   numeric(3,2) NOT NULL,
  merged_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_merge_map_no_self CHECK (merged_id <> surviving_id)
);
CREATE INDEX IF NOT EXISTS idx_pmm_surviving ON provider_merge_map(surviving_id);
CREATE INDEX IF NOT EXISTS idx_pmm_npi       ON provider_merge_map(npi);

-- POPULATION — idempotent (ON CONFLICT DO NOTHING). NPI-identity tiers only.
-- The 146 null-NPI medicaid rows matched NO nppes row by name (measured) and are
-- deliberately NOT merged — they are medicaid-only providers, not duplicates.
INSERT INTO provider_merge_map (merged_id, surviving_id, npi, rule, confidence)
SELECT c.med_id, c.nppes_id, c.npi,
       CASE WHEN c.name_ok THEN 'npi_name_match' ELSE 'npi_name_divergent' END,
       CASE WHEN c.name_ok THEN 1.00 ELSE 0.85 END
FROM (
  SELECT m.id AS med_id, n.id AS nppes_id, m.npi,
    ( m.mn = n.nn
      OR m.mn LIKE '%'||n.nn||'%' OR n.nn LIKE '%'||m.mn||'%'   -- substring (middle initial / suffix)
      OR m.mt = n.nt                                             -- token-set equal (last/first reorder)
      OR m.mt LIKE '%'||n.nt||'%' OR n.nt LIKE '%'||m.mt||'%'    -- token-set subset
    ) AS name_ok
  FROM (
    SELECT id, npi, name,
           lower(regexp_replace(name,'[^a-zA-Z]','','g')) AS mn_raw
    FROM directory_providers WHERE source='medicaid' AND npi IS NOT NULL
  ) mm
  JOIN LATERAL (
    SELECT mm.id AS id, mm.npi AS npi, mm.mn_raw AS mn,
           (SELECT string_agg(t,'' ORDER BY t)
              FROM regexp_split_to_table(lower(regexp_replace(mm.name,'[^a-zA-Z ]','','g')),'\s+') t WHERE t<>'') AS mt
  ) m ON true
  JOIN LATERAL (
    SELECT n0.id AS id,
           lower(regexp_replace(n0.name,'[^a-zA-Z]','','g')) AS nn,
           (SELECT string_agg(t,'' ORDER BY t)
              FROM regexp_split_to_table(lower(regexp_replace(n0.name,'[^a-zA-Z ]','','g')),'\s+') t WHERE t<>'') AS nt
    FROM directory_providers n0 WHERE n0.source='nppes' AND n0.npi = m.npi
  ) n ON true
) c
ON CONFLICT (merged_id) DO NOTHING;

-- INERT person-level view — one row per person (every row not absorbed as a
-- merged_id). Nothing consumes it yet. Yields 106,658 rows.
CREATE OR REPLACE VIEW directory_persons AS
SELECT d.*
FROM directory_providers d
WHERE NOT EXISTS (SELECT 1 FROM provider_merge_map m WHERE m.merged_id = d.id);

-- Verify (expect 16934 / 106658):
--   SELECT count(*) FROM provider_merge_map;
--   SELECT count(*) FROM directory_persons;
-- Escape hatch (full annul, non-destructive):
--   DROP VIEW directory_persons; TRUNCATE provider_merge_map;
-- Escape hatch (annul only the lower-confidence tier):
--   DELETE FROM provider_merge_map WHERE rule='npi_name_divergent';

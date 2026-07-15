-- Step 1 of the org-layer sync (scripts/orgs-sync.mjs), lifted out to psql.
--
-- Why this file exists: the neon() HTTP driver runs on Node's fetch, whose
-- undici headersTimeout is 300s. Anthem alone is 1.4M rows × ~2.6KB of TOASTed
-- raw_resource, so this scan takes >5min and the driver kills it with
-- UND_ERR_HEADERS_TIMEOUT before Postgres ever finishes. psql has no such
-- client timeout, so it simply waits.
--
-- Run this, then the rest of the sync:
--   psql "$DATABASE_URL" -f sql/maint/org-affiliations-sync.sql
--   node --env-file=.env.local scripts/orgs-sync.mjs --skip-affiliations
--
-- Idempotent. Single statement over all payers — no per-payer chunking needed
-- here, since the chunking in orgs-sync.mjs existed only to dodge that timeout.

\timing on

INSERT INTO org_affiliations (npi, payer_source_id, org_ref, org_display)
SELECT DISTINCT p.npi, p.payer_source_id,
       p.raw_resource->'organization'->>'reference',
       p.raw_resource->'organization'->>'display'
FROM provider_network_participation p
WHERE p.raw_resource->'organization'->>'reference' IS NOT NULL
  AND p.raw_resource->'organization'->>'display' IS NOT NULL
ON CONFLICT (npi, payer_source_id, org_ref)
  DO UPDATE SET last_seen = CURRENT_DATE, org_display = EXCLUDED.org_display;

SELECT s.slug, count(*)::int AS affiliations
FROM org_affiliations a JOIN payer_sources s ON s.id = a.payer_source_id
GROUP BY s.slug ORDER BY count(*) DESC;

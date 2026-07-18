-- sql/060 — Search performance: pg_trgm GIN indexes for the ILIKE hot paths
-- (TASK-SEARCH, founder directive 2026-07-18: "all search in all tables snappy").
--
-- MEASURE-FIRST (NYS-114). Each index below is here because EXPLAIN ANALYZE named
-- an ILIKE seq-scan as the bottleneck on a live search surface. Before/after, live
-- Neon (PG 17.10), warm cache, real \timing (not EXPLAIN's inflated numbers):
--
--   /orgs search (tin_registry.business_name ILIKE, joined to org_tin_rosters):
--       368 ms  ->  ~40 ms  (2.3 ms in the pure plan)   ~9x
--       The trigram index let the planner drop a 150k-row hash join over
--       org_tin_rosters for a nested loop from the ~1.4k matched TINs. No org
--       summary matview needed — the index alone fixed both search and the join.
--
--   /rates Services search (rate_table_child_mv.display_name ILIKE, the keystroke
--   path in listRateRows): 164 ms -> 87 ms   ~2x
--       display_name is now a GIN-trigram probe instead of a scan of the whole
--       unpivoted set before the window count.
--
-- WHY THESE ARE SAFE ON THE MATVIEW (NYS-88). rate_table_child_mv is refreshed
-- with REFRESH MATERIALIZED VIEW CONCURRENTLY in the post-ingest chain. That path
-- maintains EVERY index on the matview automatically — a non-unique GIN trigram
-- index does not touch CONCURRENTLY eligibility, which only requires ONE unique
-- index on PLAIN columns (idx_rate_table_child_grain already provides it). So this
-- file adds NO step to the post-ingest chain; the indexes ride the existing
-- REFRESH. (The NYS-88 trap is specifically an *expression* column inside the
-- *unique* index — not the case here.)
--
-- Idempotent. Applied live 2026-07-18 with CREATE INDEX CONCURRENTLY (no table
-- lock); the plain form below is for replay on a fresh DB.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- /rates Services search — display_name is the dominant free-text term.
CREATE INDEX IF NOT EXISTS idx_rtc_display_trgm
  ON rate_table_child_mv USING gin (display_name gin_trgm_ops);

-- /orgs search — business_name ILIKE over the TIN registry.
CREATE INDEX IF NOT EXISTS idx_tin_registry_name_trgm
  ON tin_registry USING gin (business_name gin_trgm_ops);

ANALYZE rate_table_child_mv;
ANALYZE tin_registry;

-- NOTE (directory_providers): already fully trigram-indexed (sql/005 + sql/022:
-- name/city/profession/subspecialty/primary_taxonomy). Measured residual is the
-- 5-column BitmapOr itself — a name-only query is 23 ms but the OR pays for the
-- profession/subspecialty/taxonomy trigram scans (~400 ms of the 586 ms) even
-- when the term is a surname. Reordering that search (name-first, broaden only on
-- a thin result) changes user-visible behavior on a shared surface, so it is
-- flagged for the lead rather than changed here. The hybrid-UX layer (client-side
-- instant filter + keep-previous) masks the residual in the meantime.

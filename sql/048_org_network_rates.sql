-- sql/048 — org_network_rates: the data gate for the exact-rate tree
-- (NYS-147 §5, Insurer → Network → Org) and the rate-index / Find-my-plan org
-- level. One row per (canonical network, billing TIN, billing code) over the
-- FULL 13.4M-row provider_rate_signals corpus, resolved through the sql/044
-- network-alias layer. A live query at this grain measured 17s for ONE
-- network × code (2026-07-18) — hence the matview.
--
-- EXACT-RATE-FIRST (the binding NYS-37/NYS-35 ruling): no medians, no
-- percentiles, no bands. The row carries n_rates honesty instead:
--   • rate_single — the exact attested figure, present ONLY when the
--     org × network × code resolves to one distinct negotiated rate;
--   • rate_min / rate_max — the attested extremes, for honesty labels
--     ("3 clinician rates"), never for a median column.
-- Multiple distinct rates within an org are the NORM, not the edge (measured:
-- only 204 of 14,066 Aetna Choice POS II orgs are single-rate at 90837 — the
-- spread is per-NPI contract tiers, same code, same setting). The exact figure
-- for a multi-rate org lives at the provider grain — surfaces must drill, not
-- summarize.
--
-- The alias join is DEDUPED on (network_id, payer_label, network_label):
-- fhir + mrf alias rows may carry the same label pair, and a raw join would
-- double-count rate rows. The unique index is PLAIN COLUMNS (the NYS-88 trap:
-- an expression column silently disqualifies REFRESH CONCURRENTLY).
--
-- Nightly refresh: registered in ops/harvest/sync-plan.mjs (both executors
-- pick it up — the no-fork guarantee from NYS-129).

CREATE MATERIALIZED VIEW IF NOT EXISTS org_network_rates AS
SELECT a.network_id,
       s.tin,
       s.billing_code,
       count(DISTINCT s.npi)::int             AS n_npis,
       count(DISTINCT s.negotiated_rate)::int AS n_rates,
       CASE WHEN count(DISTINCT s.negotiated_rate) = 1
            THEN min(s.negotiated_rate) END   AS rate_single,
       min(s.negotiated_rate)                 AS rate_min,
       max(s.negotiated_rate)                 AS rate_max,
       max(s.as_of)                           AS as_of,
       max(s.file_date)                       AS file_date
FROM (SELECT DISTINCT network_id, payer_label, network_label FROM network_aliases) a
JOIN provider_rate_signals s
  ON s.payer = a.payer_label AND s.plan_or_network = a.network_label
GROUP BY a.network_id, s.tin, s.billing_code;

-- Plain-column unique key — required for REFRESH CONCURRENTLY (sql/README trap).
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_network_rates_key
  ON org_network_rates (network_id, tin, billing_code);
-- The tree's read path: one network × one code → its orgs.
CREATE INDEX IF NOT EXISTS idx_org_network_rates_code
  ON org_network_rates (network_id, billing_code);

ANALYZE org_network_rates;

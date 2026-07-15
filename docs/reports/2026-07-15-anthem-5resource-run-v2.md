# 2026-07-15 — Anthem five-resource run (report v2)

_Continues `2026-07-14-anthem-api-expansion.md`. Covers the concurrent-run attempt → escape-hatch trip → pause._

## Shipped
- No new code since v1 (commit 56f6bf1 = harvester). This is an operational/decision report.
- Report committed to `docs/reports/`; still local-only (push stood down).

## DB changes
- `fhir_locations`: smoke 3 → **11,588 rows** (partial; five-resource harvest was stopped mid-location-phase at item ~12,300 of 37,458).
- `fhir_organizations` / `fhir_org_affiliations` / `fhir_healthcare_services` / `fhir_insurance_plans`: still smoke values (3 / 2 / 34 / 100) — those phases never started (location runs first under `--resource=all`).
- `provider_qualifications`: unchanged (69,416).
- Primary `provider_network_participation`: still filling — 87,042 / 106,497 NPIs probed (~82%).

## Decisions
- Launched the five-resource harvest CONCURRENTLY with the primary (conc 5) — reversed the earlier "hold for go" because no per-call cost + shared/deduped grain.
- The automatic escape hatch (PID-based watcher) TRIPPED: primary probe rate fell to 120/3min for two windows → watcher killed the five-resource harvest, primary untouched. Real contention, not a false trip (primary had been running several hundred/3min earlier). Concurrency 5 is too much for Anthem to serve both.
- Fell back to primary-only per Brendan's escape-hatch instruction. Five-resource PAUSED, resumable.
- PENDING (Brendan leaning yes, NOT yet greenlit): pause the primary's last ~18% and run the five-resource set SOLO now (it's far faster — 11.6k locations in minutes vs the NPI crawl), then resume the NPI tail overnight. Assessed sound; mandatory caveat = post-NPI re-run sweep for stragglers.

## Open items
- Five-resource harvest paused at ~11.6k/34.9k locations. Resume: `node --env-file=.env.local scripts/ingest-anthem-resources.mjs --resource=all --resume`. Run SOLO (not concurrent).
- After the primary NPI harvest finishes: re-run the five-resource enumeration (`--resume`) to sweep location/org IDs the last 18% surfaced — MANDATORY, cheap.
- Re-run `extract-qualifications.mjs` post-primary. NYS-60 not built. No UI surfacing yet.

## Gotchas
- Watchers MUST track by PID (harvest 51524 gone; babysitter 5186; primary-completion watcher buy977cs4 still armed) — `pgrep -f 'ingest-anthem-resources'` self-matches the watcher's own command line (bug hit + fixed, killed watcher b4lq8wuke).
- Concurrency 5 five-resource + concurrency 12 primary = Anthem throttles the primary. Run five-resource solo.
- Row counts lag mid-run (500-row batch flush).
- Push stood down; shared `main` also has another session's 4 unpushed "Published rates" commits + uncommitted files (leave alone).

# Anthem landing — 2026-07-15 (DB/ingest)

## Shipped
- **NYS-15 CLOSED — primary NPI harvest complete.** 106,497/106,497 probed, 27,393 matched, 4,358,439 roles (~159/provider), 541 networks, **0 unmatched**. 93.3% accepting.
- **NYS-53 five-resource harvest complete** (solo, ~2h20m, clean). NYS-55/56/57/58 closed; NYS-59 half-done (Organization ✅, Practitioner ❌).
- **Mandatory straggler re-sweep earned its name**: +5,931 locations (13% of the table) that the primary's last 14% surfaced. Skipping it would have silently dropped them.
- **NYS-54 re-run**: `provider_qualifications` 69,416 → **99,511** rows / 27,393 NPIs (35,059 licenses, 24,423 NY).
- **Post-ingest routine complete**, in order.
- **orgs-sync fix** (`534f95d`, local, NYS-65) — see Decisions.
- **Pushed 18 backed-up commits** (`f34a4a7..f76a269`) to production; build clean; smoke-checked signed-in (`/directory` 26 rows, `/published-rates` 101, `/clients` 13, no h-overflow).

## DB changes
| Table | Rows | |
| -- | -- | -- |
| `provider_network_participation` (anthem) | 1,206,247 → **1,408,077** | 2,441,556 all payers |
| `fhir_locations` | **44,916** | geo 100%, phone 99.7%, accessibility 62%, **hours 0** |
| `fhir_organizations` | **5,851** | npi/address/phone/taxonomy |
| `fhir_org_affiliations` | **2,664** | 598 orgs (9.6%), ~4.5 each |
| `fhir_healthcare_services` | **56,646** | **languages 0, telehealth all-false** |
| `fhir_insurance_plans` | **809** | 1 API call → whole national catalog |
| `provider_qualifications` | **99,511** | |
| `org_affiliations` | +163,523 | anthem 158,721, humana 4,802 |

Matviews refreshed: 021, 023, 024×3, `org_tin_*`, `rate_table_mv`, `rate_table_child_mv` (032 — not in the handoff's routine; added because orgs-sync rebuilds its input). TIN naming 95.9% → **96.0%** (29,764/31,233 named).

## Decisions
- **Paused the primary at 91,626 to run the five-resource set solo.** Correct: solo held ~420 items/min with zero throttling, vs the contention that tripped the escape hatch on 07-14.
- **Rewound the checkpoint ~500 NPIs before resuming.** `writeCheckpoint` advances per 12-NPI chunk but `partBuf` only flushes at 500 rows, and there's no SIGTERM handler → a kill strands up to ~499 rows for NPIs already marked probed. Safe because NPI order is `md5(npi)` (stable hash, not a per-run shuffle) and upserts are idempotent. **Verified lossless**: final `probed` = 106,997 = 106,497 + 500. Filed **NYS-61** for the flush-on-SIGTERM fix.
- **orgs-sync step 1 moved to psql** (**NYS-65**). It needs ~11min (680s) at Anthem scale; undici's 300s `headersTimeout` killed it twice. Rejected: NPI-bucket chunking (strictly worse — each bucket re-scans, 10×115s > one 680s pass) and a custom undici dispatcher via Neon `fetchOptions` (**fails at 94s** — Node's global fetch uses its own internal undici). New `sql/maint/org-affiliations-sync.sql` + `--skip-affiliations`.
- **Re-ran the whole post-ingest tail** after that timeout rather than accepting it. Justified: the stale-org-layer run reported a **+0** naming gain; the correct run found **195 ein-TINs and +24 names**.

## Open items
- **NYS-65** (High) — port heavy scripts to the Neon WebSocket `Pool`; blocked on `ws` (test Node 22's global `WebSocket` first). The psql sidecar works but splits the execution model, and plain `node orgs-sync.mjs` still fails.
- **NYS-61** — flush on SIGTERM so a pause is lossless without hand-rewinding. A deliberate pause must exit **0**, or `babysit.sh` restarts it.
- **NYS-47** — measured: `provider_network_participation` = **7,789 MB, 72.5% TOAST** (`raw_resource`, avg 2,636 B/row) = ~31% of the 18 GB DB. Neon cost line-item still unmeasured.
- **NYS-62** (Low) — React hydration mismatch (#418) in the signed-in app; page not yet isolated.
- **NYS-59** — Practitioner is now the *only* remaining path to languages (NYS-57 returned zero). Probe a few resources for `communication` before committing to 27,393 dereferences.
- Unfiled, awaiting your call: **two migrations numbered 029** (`029_anthem_resources.sql` + `029_photon_demo.sql`); Google Maps loading without `loading=async` + deprecated `AutocompleteService`; duplicate graphql-tag fragments (`PatientFields`, `CatalogFields`).
- **NOT pushed.** Tree carries 6 other sessions' commits (nonprofit TIN naming, published-rates, Photon Phase 2, NPPES sync) that a push would also ship.

## Gotchas
- **The "Neon 5-minute ceiling" is not Neon's.** It's undici's 300s `headersTimeout` in Node's `fetch`. Every `neon()` HTTP script shares it; Postgres keeps running after the client hangs up.
- **A timeout in orgs-sync fails *silently downstream*** — everything after it rebuilds happily on a stale org layer and reports "+0", which is indistinguishable from "nothing to do."
- **`fhir_*` is national, not NY.** Only **55.6%** of locations are NY; 17,286 across 51 states (NJ 7%, PA 6.3%, CA 4.2%, TX 4%) — reverse-lookup returns each NPI's *nationwide* roles. `fhir_insurance_plans` is Elevance's whole national catalog. **Filter by state or you'll show Texas plans to a Buffalo user.**
- **`fhir_healthcare_services.telehealth` is a false signal.** Derived from `delivery_methods`, which has exactly one distinct value across all 56,646 rows: `["physical"]`. It's a non-null boolean that can never be true — a "telehealth: yes" filter returns zero rows forever, silently. Prefer NULL over false (NYS-57).
- **Acceptance is per-network, not per-provider**: accepting (25,544) + not (5,662) > 27,393 because **3,813 providers are accepting in one Anthem network and closed in another**.
- **The proof report's row count is Anthem-only** (1,408,077); the table holds all payers (2,441,556). Don't read one as the other.
- Log counters overcount after a rewind (stats are restored from the checkpoint, line 787) — **the DB is authoritative**.
- `.harvest/*.log` uses `\r`, so it's one giant line: `grep` needs `-a` and a `tr '\r' '\n'`, and bare HTTP codes in a filter (`403`) match progress counters like `4030/6198`.
- Watchers track by **PID**, never `pgrep -f`. Watch the **babysitter**, not node — it restarts node with a new PID.

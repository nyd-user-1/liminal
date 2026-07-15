# 2026-07-15 — tin_registry: EIN → name from IRS EO data (ProPublica)

## Shipped
`52e3bfd`
- `scripts/enrich-eins-propublica.mjs` (new) — fetch + load; `--fetch-only` / `--load-only` / `--dry-run`
- `scripts/ein-enrichment-results.json` (new, 304KB) — all 2,064 attempts; audit trail AND `--load-only` input (no network)

## DB changes
- **`tin_registry` 29,163 → 29,742** (+584, `source = 'irs_eo'`). No existing row touched (`ON CONFLICT (tin_norm) DO NOTHING`).
- **Unnamed ein-type TINs on the rate corpus: 2,064 → 1,480.**
- **`rate_table_mv` REFRESHed** (CONCURRENTLY, 28s; 38,716 rows unchanged):
  - named **36,167 → 36,963** (93.4% → **95.5%**)
  - unnamed **2,549 → 1,753** — all 1,753 are multi-clinician
  - 497 of the 584 named TINs land in the MV (796 rows); the other 87 sit outside the 6-payer / 5-code allowlist
- API: **584 hits / 1,480 misses / 0 errors** of 2,064 = **28.3%**. Every miss is HTTP 404.
- No migration. No schema change. `rate_table_child_mv` unaffected (it reads `directory_providers`, not `tin_registry`).

## Decisions
- **The exact DB `tin` is carried end-to-end and never reconstructed.** `provider_rate_signals` stores `ein:010459837`; the API is called on `010459837` and echoes `10459837`. Rebuilding the key from either would name nothing. Gated as briefed: 5 rows inserted, re-checked against `provider_rate_signals`, all resolved, then the bulk load.
- **Padded-then-raw lookup** — 7 of 2,064 targets are stored 8-digit (leading zero eaten upstream); the API only answers on the true 9 digits.
- **Errors are not misses.** A network failure records `http_status: 0`, and >20 errors at >10% of calls aborts the run — recording an unreachable API as "for-profit" would silently poison the audit trail.
- **Results JSON committed** (304KB / 30KB gzipped). It makes the load re-runnable with no API calls and is the evidence for NYS-66's 1,480.
- Target query is the brief's: whole corpus, not the 5 codes / payer allowlist — hence 2,064 targets vs the 2,050 quoted in the brief and the 2,059 seen after the 5-row test.
- Filed **NYS-66** for the for-profit remainder rather than attempting OpenCorporates/state registries (out of scope per brief).

## Open items
- **1,480 for-profit groups still unnamed — NYS-66** (Medium). Structural: only 501(c) orgs file 990s. The MRF `business_name` sidecar is the only route keyed on the EIN itself; blocked on signed URLs, same fetch as **NYS-64**.
- Most newly-named orgs are large (57–118 clinicians) → platform TINs (>25) → **their count cells have no expander** (see the tree report). Newly named makes this more visible, not less.
- Page still behind sign-in; not shown to any practice.

## Gotchas
- **ProPublica returns 200 with `{organization: {...}}`; 404 means "not in EO data", which is an ANSWER, not an error.** Do not retry 404. Retry only 429/5xx.
- **Only 501(c) organizations file 990s.** A 71.7% miss rate here is a fact about the corpus (most of NY behavioural health is for-profit), not a broken script. Do not "improve" it with fuzzy matching.
- **Hits are mostly NOT New York**: 200 NY of 584 — CT 42, NJ 36, MA 33, PA 27, FL 23. Consistent with the directory's NY-*licence* (not NY-address) inclusion rule.
- Rate limit is 5 req/s / concurrency 5 across all workers → ~7 min for 2,064. It is a free public API; raising this will get you throttled.
- `business_name` is NOT NULL in `tin_registry` — a hit with no `organization.name` must be treated as a miss, never a placeholder.
- Names arrive title-cased from the IRS ("Nyu Lutheran Medical Center", "Umass Memorial Health Care Inc"), unlike NPPES legal names which are upper-case. Both render verbatim; `rowName` only reformats rows carrying the `(individual)` suffix.

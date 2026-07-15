# 2026-07-14 — /published-rates + MRF tin-name sidecar

## Shipped
- `c9442fb` — `sql/027_rate_table.sql`, `scripts/backfill-tin-names.mjs`, `lib/rate-table.ts`,
  `lib/repos/rate-table.ts`, `app/(app)/published-rates/{page,published-rates-client}.tsx`,
  `components/ui/data-table.tsx`, `components/shell/topbar.tsx`
- `cf040ce` intro copy removed · `13df548` /directory toolbar + Insurer column + tabs + contained scroll
  (`components/ui/column-picker.tsx`, `components/rates/insurer-mark.tsx`)
- `091762e` insurer→filter chip, Type/Billing ID/NPI columns, First-Last names
- `337f214` `tin` = billing identifier, not a TIN; entity_kind reads the identifier
- `2e90a50` `scripts/mrf/scan-tic.mjs` (`--tin-names`, `--tins`), `scripts/mrf/load-tin-names.mjs`

## DB changes
- **NEW `rate_table_mv`** (sql/027). 38,716 rows: Cigna 12,562 / Empire 9,604 / Oxford 8,404 /
  Emblem 4,663 / Fidelis 2,793 / MetroPlus 690. Unique idx `(payer,tin)`, btree `(payer,credential_norm)`.
  Builds 5.4s. Rebuilt (DROP+CREATE) once for entity_kind; refreshed 3×.
- **`tin_registry` writes only.** Coverage on the 26,288 non-Aetna TIN universe: **6,102 (23.2%) → 23,958 (91.1%)**
  - +17,263 roster-derived · +59 relaxed FHIR crosswalk (≥5 shared vs orgs-sync's ≥10)
  - **439 repaired** (npi-identified orgs named after a roster member) · +535 named from the identifier
  - +66 MRF `business_name` (source `highmark-de-mrf`); 30 of 44 overlapping rows were wrong
- entity_kind after fix: individual 28,271 / organization 10,445 (439 reclassified).
- **Refresh order:** 021 → 023 → 024 → `orgs-sync.mjs` → `backfill-tin-names.mjs` → `REFRESH rate_table_mv` → `ANALYZE`.

## Decisions
- Route `(app)/published-rates`, not `(site)/` — brief contradicted itself; "Done when" requires sign-in.
- **`unstable_cache` not used.** Next's data cache hard-caps entries at 2MB; corpus ~12MB → rejection
  surfaced as a render error. 1h in-process cache in the repo (`checkedBooksCache` precedent).
- **`scrollToKey` anchors** the batch at the target rather than growing to it: growing mounted ~12k rows
  in 8.6s for a bottom-ranked match. Anchored: 486ms / 100 rows.
- **Column is "Billing ID", not TIN.** MRF `tin` = `{type: ein|npi}`; type is the *payer's* choice
  (Empire 100% npi, Fidelis/MetroPlus 100% ein, Cigna 72/28). 28,210 NPIs appear under both kinds; an NPI
  is not a tax ID. NPI column reads the roster, not the identifier (1,074 identifiers aren't members).
- `as_of` = `max(file_date)`, not `provider_rate_signals.as_of` (= scan date, ~today for every payer);
  otherwise MetroPlus's 2024-02-07 book renders as current.
- "Clinician" → "Provider": undefined in BUILD_SPEC; 83 uses all in the rates lane vs 751 for provider.
- Payer allowlist not blocklist: Aetna/UHC-NY/CDPHP/Oxford-CT resolve <8% single-rate.
- `DataTable` extended (`lazy`, `scrollToKey`, `fillHeight`, `toolbarLeft`, `headTitle`); `table.tsx` untouched.
- Report committed separately from the code so its hashes are real.

## Open items
- **Sidecar built + proven but NOT run against our six payers.** Cigna + EmblemHealth CDNs now require
  signed URLs (`MissingKey`); each needs a fresh index fetch. Empire's signed URLs are on disk, valid to
  2026-08-21, but Empire is 100% npi-type → no `business_name`. Only this settles naming (Cigna 86% → ~100%).
- 13,103 rows typed "individual" rest on roster-of-one; sample says ~68% of those EINs are organisations.
- entity_kind still reads "Individual" for MRF-named orgs (roster=1) — Type column looks wrong there.
- Tab says "Providers" while its Type chips say "Individual"; an org is also a provider.
- `docs/TASK-PUBLIC-RATE-TABLE.md` still specifies the removed header copy + last-4 TIN masking.
- No Linear tickets filed.

## Gotchas
- **VALUE imports from `lib/repos/*` in a `"use client"` file** drag `lib/db` into the browser bundle; the
  Neon proxy's get-trap throws "DATABASE_URL is not set". Client imports `lib/rate-table.ts` (pure). Every
  other client component uses `import type` only.
- **Repo cache is in-process, 1h.** After `REFRESH` the dev server serves stale rows until restarted.
- `business_name` rides on **ein-type tins only**; npi-type carry none.
- `TextLink`'s default `wipe` variant cannot truncate (label is a flex item of an inline-flex anchor); this
  page uses `variant="primary"` + `!block`. `/directory` shares the bug, hidden by short names.
- `formatDate("YYYY-MM-DD")` parses UTC midnight → renders the previous day in ET.
- `.harvest` raw MRFs are gone; derived CSVs have no `business_name` column. Re-fetch required.
- `lower(billing_class)` + `negotiated_type NOT ILIKE '%percent%'` are load-bearing, not cosmetic.

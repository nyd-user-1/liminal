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

---

# Addendum 2026-07-15 — naming the 9%

## Shipped
- No code changes. Investigation only; nothing committed since `d66b183`.

## DB changes
- None since `d66b183`. `rate_table_mv` unchanged at 38,716 rows / 35,178 named (90.9%).
- Unnamed: **3,538 rows / 2,182 TINs** — `ein` 3,406 rows/2,050 TINs, `npi` 132 rows/132 TINs.

## Decisions
- **Group naming will use NPPES, not EINs and not the MRF.** Route: roster NPI → its NPPES LOCATION
  address+phone → the NPI-2 org at that same address/phone → that name is the group's.
  Verified 2/2 against Brendan's predictions: `ein:042774441` → BOSTON CHILDREN'S HOSPITAL;
  `ein:410834920` → MCCD PSYCHIATRY SERVICES PLLC (Talkiatry) via `109 W 27TH ST #5S` + `833-351-8255`.
- **MRF `business_name` sidecar demoted to backlog enrichment.** Built (`2e90a50`) and proven, but blocked
  on signed URLs and not needed for the spine.
- **Match gate = exact address+phone on an NPI-2; skip on ambiguity.** No majority rule: BCH matched 2 of 12
  roster members, Talkiatry 1 of 2. 300 Longwood alone returns BCH Dental Group, Boston Brace, 3× BCH
  Connected Care and 4× BOSTON CHILDREN'S HOSPITAL — ambiguous addresses must skip, not guess.
- IRS EO BMF considered and rejected as the spine: nonprofits only.

## Open items
- **Group naming NOT run.** 2,182 TINs, ~12,132 roster NPIs + address searches; est. 20–40 min throttled.
- 132 unnamed TINs are `npi:`-identified → direct NPPES lookup, no address inference needed. Do these first.
- `entity_kind` still roster-derived; `is_sole_proprietor` unused (answers 26,497 of 28,991 one-NPI rows:
  17,981 sole proprietor / 8,516 employed).
- Report now exceeds the 60-line cap (append-only, per instruction).
- No Linear tickets filed.

## Gotchas
- **NPPES holds no EIN.** `nppes_organizations.ein` = **0 of 104,060** (CMS suppresses it). EIN→org is
  impossible from NPPES. Do not attempt it.
- **Every one of the 12,132 roster NPIs on unnamed TINs is an NPI-1.** A roster lookup returns *people*,
  never the practice; the org only comes from the members' address/phone.
- `directory_providers.parent_org` = 231 of 123,577. Unusable.
- **CMS TiC defines no name field.** `business_name` and `network_name` are payer extensions — that's why
  only some files carry them.
- IRS EO BMF (`irs.gov/pub/irs-soi/eo1.csv`, 49MB) does map EIN→name, nonprofits only:
  `042774441` = CHILDRENS HOSPITAL CORPORATION, `431987409` = CHILDRENS HOSPITAL PEDIATRIC ASSOCIATES INC.
- **Address-only matching is unsafe.** Unnamed rosters are geographically scattered (one EIN spans Boston,
  Brighton, Rochester, Cooperstown) and false-matched U of R Psychiatry and Bassett. Phone is the tiebreak.
- Cigna + EmblemHealth CDNs now require signed URLs (`MissingKey`); the unsigned URLs in our own harvest
  logs from 2026-07-12 now 403. Empire's signed URLs are on disk, valid to 2026-08-21, but Empire is
  100% `npi`-type and carries no `business_name`.

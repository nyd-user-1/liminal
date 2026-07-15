# 2026-07-15 — /published-rates: naming the unnamed 9%

Continues `docs/reports/2026-07-14-published-rates.md`.

## Shipped
- No code changes. Investigation only; nothing committed since `d66b183` except this report.

## DB changes
- None since `d66b183`. `rate_table_mv` unchanged: 38,716 rows / 35,178 named (90.9%).
- Unnamed: **3,538 rows / 2,182 TINs** — `ein` 3,406 rows / 2,050 TINs, `npi` 132 rows / 132 TINs.
- Every unnamed row is a multi-NPI group. **Zero one-NPI rows are unnamed** (28,991 of 38,716 rows have
  exactly one NPI; all named). 0 of 9.3M `provider_rate_signals` rows lack an NPI.

## Decisions
- **Group naming goes via NPPES, not EINs and not the MRF.** Route: roster NPI → that NPI's NPPES LOCATION
  address + phone → the NPI-2 org at the same address/phone → that name is the group's.
  Verified 2/2 against Brendan's predictions: `ein:042774441` → BOSTON CHILDREN'S HOSPITAL (300 LONGWOOD
  AVE); `ein:410834920` → MCCD PSYCHIATRY SERVICES PLLC (Talkiatry) via `109 W 27TH ST #5S` + `833-351-8255`.
- **MRF `business_name` sidecar demoted to backlog enrichment.** Built (`2e90a50`) and proven on a fixture,
  but blocked on signed URLs and not needed for the spine.
- **Match gate = exact address + phone on an NPI-2; skip on ambiguity.** No majority rule: BCH matched 2 of
  12 roster members, Talkiatry 1 of 2. 300 Longwood alone returns BCH Dental Group, Boston Brace, 3× BCH
  Connected Care and 4× BOSTON CHILDREN'S HOSPITAL — ambiguous addresses skip, never guess.
- IRS EO BMF considered and rejected as the spine: nonprofits only.
- Report split from the 07-14 file rather than appended, to hold the 60-line cap.

## Open items
- **Group naming NOT run.** 2,182 TINs / ~12,132 roster NPIs + address searches; est. 20–40 min throttled.
- 132 unnamed TINs are `npi:`-identified → direct NPPES lookup, no address inference. Do these first.
- `entity_kind` still roster-derived; `is_sole_proprietor` unused — it answers 26,497 of 28,991 one-NPI rows
  (17,981 sole proprietor / 8,516 employed) and would retire the roster-of-one inference.
- Tab reads "Providers" while its Type chips read "Individual" on the same rows.
- `docs/TASK-PUBLIC-RATE-TABLE.md` still specifies the removed header copy + last-4 TIN masking.
- No Linear tickets filed.

## Gotchas
- **NPPES holds no EIN.** `nppes_organizations.ein` = **0 of 104,060** (CMS suppresses it). EIN→org is
  impossible from NPPES. Do not attempt it.
- **Every one of the 12,132 roster NPIs on unnamed TINs is an NPI-1.** A roster lookup returns *people*,
  never the practice; the org only comes from a member's address/phone.
- `directory_providers.parent_org` = 231 of 123,577. Unusable.
- **CMS TiC defines no name field.** `business_name` and `network_name` are payer extensions — which is why
  only some payers' files carry them.
- IRS EO BMF (`irs.gov/pub/irs-soi/eo1.csv`, 49MB) does map EIN→name, nonprofits only:
  `042774441` = CHILDRENS HOSPITAL CORPORATION, `431987409` = CHILDRENS HOSPITAL PEDIATRIC ASSOCIATES INC.
- **Address-only matching is unsafe.** Unnamed rosters are geographically scattered (one EIN spans Boston,
  Brighton, Rochester, Cooperstown) and false-matched U of R Psychiatry and Bassett. Phone is the tiebreak.
- Cigna + EmblemHealth CDNs now require signed URLs (`MissingKey`); the unsigned URLs in our own harvest
  logs from 2026-07-12 now 403. Empire's signed URLs are on disk, valid to 2026-08-21, but Empire is
  100% `npi`-type and carries no `business_name`.
- NPPES API: one NPI per `number=` call; org search is `enumeration_type=NPI-2` + `address_purpose=LOCATION`
  + city/state/postal_code. No documented rate limit; throttle and cache locally anyway.

# 2026-07-15 — /published-rates: group headers; network + setting as columns

Supersedes `2026-07-15-published-rates-tree.md` (its 2–25 cap and count-cells are gone).

## Shipped
- `sql/032_rate_table_children.sql` — regrained to (billing ID, insurer, NPI, **network**, **setting**); cap now per-(tin,payer) leaf count, ≤100
- `sql/027_rate_table.sql` — new `n_leaves` (rows the payer published under this billing ID)
- `lib/rate-table.ts` — `network`, `setting`, `nLeaves`; `isGroupHeader()`, `settingLabel()`, `networkLabel()`
- `lib/repos/rate-table.ts` — read/attach the new fields; children sort name → network → setting
- `app/(app)/published-rates/published-rates-client.tsx` — headers render empty; Network + Setting columns

## DB changes
- `rate_table_child_mv` rebuilt: **27,962 → 129,490 rows**. Build 18s. Unique idx `(payer, tin, npi, network, md5(setting))` — `setting` is a ~90-char pipe list, hashed for the index only.
- `rate_table_mv` rebuilt (DROP+CREATE, 36s): **38,716 rows, unchanged**. New column `n_leaves`.
- Shape: **14,490 rows show dollars** (n_leaves=1) · **24,226 are group headers** (n_leaves>1) · 242 headers exceed the cap and have no children.
- Single-rate resolution, 5 codes / allowlist / professional / non-percent / rate>5:
  - `(tin, payer, code)` — sql/027 — **45.5%**
  - `(tin, payer, npi, code)` — the old sql/032 — **82.0%**
  - `(tin, payer, npi, network, setting, code)` — now — **91.0%**
- `plan_or_network`, `place_of_service`, `file_date` are non-null on **826,572 of 826,572** rows. Nothing inferred.
- Leaf distribution per (tin,payer): ≤100 → 38,474 rows · >100 → 242 rows holding 108,135 children (48% of the total; largest 10,873 = Headway).

## Decisions
- **A group header renders EMPTY across every rate column.** Reverts the count-cell decision from `750a27c`. Reason is not "the count confused people" (it did) but that a column must carry one unit: `90791` held `$155.00` on one row and `4 rates` on the next — a price and a cardinality sharing a column. No wording fixes that. Brendan asked for a plain grouped table twice; I argued him out of it and was wrong.
- **The count meant distinct PRICES, not rows** — "4 rates" over 3 clinicians (Dart's $155.00 duplicated Danner's, so 3 people → 4 prices). Unreadable by construction.
- **network + setting are COLUMNS, not a GROUP BY.** They are why a row exists more than once, so they must be visible or the repeats look like duplicates. Dart is 4 rows: office $137.47 / facility $133.02 / CSTM-00 ×2 networks $155.00 (90791).
- **A row with exactly one published row still shows dollars** (14,490). Making every billing ID an empty header would leave the default view with nothing to read.
- **Cap on the row's own leaf count for THIS payer**, not the TIN's roster. The old roster gate killed all three `ein:223376459` rows — including an EmblemHealth row holding exactly one clinician — because the TIN's roster is 59 across all payers.
- `settingLabel()` reads POS 11 → Office, 21/22 → Facility; `CSTM-00` stays "Custom" (Cigna's own marker; naming it would invent a meaning).

## Open items
- **24,226 of 38,716 rows (63%) are now empty headers**, and they sort to the bottom under `90837 desc`. Browsability cost is real and unreviewed — may want default-expand or a different sort.
- **~9% of leaves still show "N rates"** — one NPI, one network, one setting, several prices, every stored column identical. **NYS-64** (scan-tic drops `billing_code_modifier`). No grain change reaches it; no deeper row to open.
- **242 headers have no children** (>100 leaves). Name links to `/orgs`, which owns those rosters.
- `2026-07-15-published-rates-tree.md` documents the superseded design; kept as the record of `750a27c`.
- Page still behind sign-in; header sentence still removed; not shown to any practice.

## Gotchas
- **`place_of_service` is a pipe-joined list**, not a scalar, and the lists are the standard non-facility/facility split: office contains `11`, facility contains `21|22`. It is a real price difference — Dart's 90791 is $137.47 office vs $133.02 facility.
- **`CSTM-00` is not a CMS code.** It is Cigna's marker, it is where the $1,183 Boston Children's rate lives, and it is NOT a facility rate. Do not filter on it as one.
- **The unique index hashes `setting`** (`md5(setting)`); indexing the raw list risks the btree row-size limit. REFRESH CONCURRENTLY needs that index.
- **Two networks can publish the same price** (Dart/Danner CSTM-00). Those rows are not duplicates — the Network column is what distinguishes them.
- sql/032 no longer reads `org_tin_rosters`, so it has no ordering dependency on the naming scripts — but refresh it WITH 027 or the halves of one row disagree.
- The dev server's repo cache is in-process/1h: an MV rebuild alone will NOT show up until restart.

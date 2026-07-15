# 2026-07-15 — /published-rates: clinician sub-rows + rate counts

## Shipped
`750a27c`
- `sql/032_rate_table_children.sql` (new) — `rate_table_child_mv`
- `sql/027_rate_table.sql` — `n_rates` per code; header rewritten
- `lib/rate-table.ts` — `n*` fields, `children`, `isChild`, `profession`, `city`, `rateCell()`, `RATE_CODES[].nKey`; `rateRowKey` appends NPI for children
- `lib/repos/rate-table.ts` — second read (children), attach by `payer::tin`; mock rows carry `n*`
- `components/ui/data-table.tsx` — `subRows` / `isSubRow` (tree)
- `app/(app)/published-rates/published-rates-client.tsx` — count cells, child name cell, tree wiring

## DB changes
- **NEW `rate_table_child_mv`** (sql/032): **27,962 rows**, grain (tin, payer, npi), groups of 2–25 only. Build 17s. Unique idx `(payer, tin, npi)`.
- **`rate_table_mv` rebuilt** (DROP+CREATE, 30s): **38,716 rows — unchanged**. New: `n90791 n90834 n90837 n90853 n99214`.
- Single-rate resolution, 5 codes / professional / non-percent / rate>5:
  - all payers: `(tin,payer,code)` **45.5%** (309,857) · +npi **37.7%** · +network **33.4%** · +pos **40.9%** (3,004,408)
  - allowlist, `(tin,payer,npi,code)`: **82.0%** single of 524,183 cells
- Group sizes: solo **28,991** · 2–25 **8,661** (47,891 children) · >25 **1,064** (168,030 children)
- No refresh of 021/023/024/025 needed; 032 refreshes with 027.

## Decisions
- **Multi-rate cells render the COUNT, not "—".** Deviates from `TASK-PUBLIC-RATE-TABLE.md` ("Multi-rate cells stay NULL and render —"). The page's headline *is* a count of distinct rates ("Cigna pays 395 different rates for 90837"); the old rule showed nothing precisely when that count exceeded 1. Three states: 0 → "—" (only honest dash), 1 → rate, n>1 → count. Picking one of the n is still forbidden; counting invents nothing and stays true whichever way NYS-64 resolves.
- **Children capped at 2–25 clinicians.** Payload, not perf: 1,064 platform TINs hold 168k children (3.5× every real practice combined). Same cap/reasoning as sql/027's `npis` array. Solo groups excluded — the parent *is* the clinician.
- **Grain reframe was half wrong.** Pushing grain down does NOT rescue the NULLs or Aetna (40.9% at full grain). The separating column is missing from ingest → NYS-64. The tree shipped without it.
- **`place_of_service` NOT added to the MV grain** — it is a pipe-joined list, so it splits cells by combination, not by setting.
- Sort orders parents only; children keep caller order (name asc). Multi-rate cells sort as −1 with blanks — no single number to rank.
- No new primitive: `DataTable` extended; `table.tsx` untouched.

## Open items
- **Platform rows (>25) show a count with no expander** — 1,064 rows. Name links to `/orgs`, tooltip does not promise expansion. Undecided: lift the cap via fetch-on-expand.
- **NYS-64** (High) — `scan-tic.mjs` drops `billing_code_modifier`; explains the counts and Aetna's "4%". Blocked on signed URLs.
- Page still behind sign-in; header sentence still removed; not shown to any practice.
- `n_clinicians` (roster, all payers) can exceed the child count (per-payer) — a 5-clinician group may open to 3 rows. Not surfaced.

## Gotchas
- **`place_of_service` is a pipe-delimited list**, not a scalar: `01|03|04|09|11|...`. It already explains real splits — NPI 1326429036, Cigna 90837: **$167.83** office list vs **$146.18** facility list.
- **The $1,183 is NOT a facility rate.** POS is `CSTM-00` (custom marker) on the Boston Children's EINs. Do not "filter facility rates" on that number.
- **`useLazyBatch` resetKey must not include `treeRows.length`** — it moves on every expand and would snap the user to the top. Keyed on parent count / sort / anchor only.
- Child `displayName` may be NULL → renders `NPI …`. A nameless child is survivable; a nameless group is what NYS-66 is about.
- `rowName` keys off the `(individual)` suffix, NOT `entityKind` — 9,243 rows are an org whose only known name is a person's.

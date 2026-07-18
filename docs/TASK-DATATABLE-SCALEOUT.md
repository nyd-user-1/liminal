# TASK — Scale the NYS-147 DataTable template outward (ui-agent)

The lead built the template hands-on on 2026-07-18 (commit + report
`docs/reports/2026-07-18-datatable.md`, checklist
`docs/UI-DATATABLE-2026-07-18.md`). **/networks is the reference
implementation** — study it in the browser first (sign in, play with every
control) before writing anything. This brief scales the template to the rest
of the product. Load the impeccable skill; keep a running checklist file; no
item is done without an after-screenshot re-checked against intent.

## What the template now provides (components/ui/data-table.tsx)

- **Per-column header menu** — click any header: Sort asc/desc (active state
  shown), Filter by value (column declares `filterValue`; active filters
  render as clearable toolbar FilterChips; filtered-to-zero renders a
  teaching row with "Clear filters"), Hide column. Right-click still opens
  the ColumnPicker.
- **`groupBy`** — the collapsible count-header tree, multi-level
  (`[{ key, label, value, defaultCollapsed? }]`), same columns top to
  bottom; group order flips only when the sort column IS the grouped
  dimension; the "Group · …" chip flattens/re-applies.
- **`bulkActions` + `BulkAction`** — floating navy bar over a non-empty
  selection (count + clear built in). Give it REAL actions only.
- **`EmptyCell`** — a missing value never renders blank: semantic label
  ("Insurer-run", "No rates") or a CTA (`onClick`/`href`) that fills it.
- Supporting refinements: `useSort` returns `setSort` third; DropdownMenu no
  longer dismisses on scrolls inside the menu.

## Binding rulings (do not re-litigate)

1. **Exact-rate-first (NYS-37/35).** A surface answering a specific question
   shows the exact attested figure — never a median, never a band as the
   lead. n_rates honesty when an org carries multiple figures.
2. Primitives law absolute; one H1 in the TopBar; min-w-0 ancestors (the
   table-overflow rule); "your plan's in-network rate · as-of {date}", never
   "your cost".

## The data layer you now have (sql/048 `org_network_rates`)

One row per (canonical network × billing TIN × billing code) over the full
13.4M-row corpus: `n_npis, n_rates, rate_single, rate_min, rate_max, as_of,
file_date`. 603,345 rows · 39 networks · 32,167 orgs. **57% of leaves are
single-rate** (`rate_single` IS the exact attested figure); the rest are
per-NPI contract tiers — the exact figure lives at the provider grain, so
multi-rate org rows must DRILL, not summarize. Reads:
`listNetworkOrgRates(networkId, code)` (~21ms) and `networkOrgCounts(code)`
in `lib/repos/networks.ts`. Refresh is registered in
`ops/harvest/sync-plan.mjs` (both executors pick it up).

## Targets, in order

1. **The rate index — the exact-rate tree surface** (UI-PUSH item 2 / NYS-37
   companion). A page whose rows are org × network × code leaves: groupBy
   Insurer → Network (count headers), leaf shows `rate_single` exactly, or
   "N clinician rates" (EmptyCell-style honesty) that drills to the provider
   grain. Headline the corpus size (the row count IS the credibility).
   Server strategy: one code slice at a time (code selector), lazy batches;
   groups default-collapsed for the big insurers. Provider drill can query
   live via `idx_prs_tin_norm` (single-org slices are small — measure first,
   NYS-114 discipline).
2. **Find-my-plan v1 (NYS-37)** — employer → plan → provider → THE exact
   figure (`getPlanRatesForNpi`), guardrail copy per the ruling. The
   UI-PUSH checklist §3 has the flow; the record shape below governs layout.
3. **/plans (NYS-39) + /orgs** — adopt header menus (`filterValue` on the
   facet columns), status tabs with counts where a status dimension exists,
   EmptyCell everywhere a "—" renders today, bulk export.
4. **NYS-148 record shape** — near-term slice first: tab count/remaining
   badges (Tabs already supports `count`) + RelatedLink dotted links on
   card fields. The full card → tabs → hairline → invariant-container shell
   is a design-system spec + shared record-shell — propose it as its own
   deliberate primitive (announce per the law).
5. **/directory → DataTable (NYS-127)** — the last hand-rolled table; port
   it onto the template (its column picker and search fold into the header
   menus + chips).

## Set-aside NYS-147 items (next after the above; don't start unprompted)

Slide-over drawer (§7), table control panel (§8), AND/OR filter builder
(§9), sparkline column (§10), row quick-actions + per-page selector (§11),
reconciliation banner (§12), and the Paylocity expandable-row dashboard
(§6 — HIGH founder interest: a grouped row expanding to an inline KPI panel;
design it against the org/network drill-down).

## House rules that bit people this week

- Stage only your own hunks; `components/rates/*` may carry another
  session's uncommitted work.
- sql range: 048 is taken (this template). Check the tree before claiming
  049/051+.
- Neon returns `Date` objects — repos return ISO strings.
- Headless verify: POST `/api/auth/login`, carry the cookie; look at
  rendered output, not exit codes.

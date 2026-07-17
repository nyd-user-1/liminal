# TASK B — Index standard v2: one header + one table, every object page

Decision, already made: the standard index layout is the one commit `e87fd62`
established and /clients wore 8 hours ago — TopBar (H1 + New + bell) · tabs
row · toolbar (search LEFT; right group = Filter · Columns · Export · Refresh
as quiet outline buttons) · DataTable. The current /clients drifted (teal
Filter pill, standalone “+ Tags”, round ＋ button, missing Columns/Export) —
that came from a later filter-menu change whose LOGIC we keep but whose
toolbar we do not.

## 1 — Restore /clients to the standard, keeping the good part
`app/(app)/clients/clients-index.tsx`: the two-level categorized FilterMenu
(dimension → values submenu) is GOOD — re-house it INSIDE the standard
toolbar's Filter button (DataTable's `filter` slot), exactly where /orders
puts its ChipMenu. Kill the teal pill, the standalone Tags chip, and the
round ＋; restore Columns (column picker), Export, Refresh. Diff your result
against git `e87fd62` for the toolbar anatomy — same buttons, same order,
same placement.

## 2 — Name the primitive instead of copy-pasting it
The bottom portion already IS a primitive (DataTable owns toolbar + picker +
table + scroll). The top portion is not. Add
`components/ui/index-header.tsx`: TopBarActions (New label + bell) + the tabs
row, as one composed piece with slots (tabs items, active/onChange or hrefs,
topbar actions). Thin by design — if it grows logic, it's wrong. Document
both halves together on /design-system as "the index page standard."

## 3 — Sweep every object index onto the pair
Pages: /clients, /directory (providers + programs lists), /orgs (books),
/orgs/registry, /plans, /recruiting, /prescriptions, /orders, /catalog,
/billing (list views), /library if it fits without distorting its
card-gallery nature (if not, note why and leave it). For each: IndexHeader +
DataTable, search left, Filter/Columns/Export/Refresh right (omit a button
only where it's genuinely meaningless — then say so in the report), no
page-level horizontal scroll, single-row headers, min-w-0 ancestor chain
(the recurring overflow bug — check ancestors, not the table).
DO NOT redesign page content or change any query — this is a shell sweep.
Where a page already matches (orders, catalog, registry), just swap in
IndexHeader and move on.

## Out of scope
Drill-down/record pages (TASK-CLIENT-BOARD.md). The rates tool panels
(roster/spread/apply-next — just recomposed, leave alone). Any board work.

## Done when
1. /clients is pixel-faithful to the e87fd62 toolbar anatomy WITH the
   two-level filter living under the Filter button.
2. Every listed index page renders IndexHeader + DataTable with the standard
   toolbar; a screenshot pass across all of them shows one family.
3. `npx tsc --noEmit` clean; verify each page signed in as brendan on :3010;
   spot-check shelley for scoping regressions on /clients.
4. /design-system documents the standard.

## Working agreements
Stage ONLY your own files/hunks (concurrent sessions share the tree; another
brief may be running against components/board/* — do not touch that dir).
Commit locally; do NOT push. Report to
`docs/reports/2026-07-17-index-standard.md`, 60-line cap: Shipped / DB
changes / Decisions / Open items / Gotchas.
Linear (NYS team): file a ticket at start, close on done; Open items get
their own tickets. No access → say so in the report.

# DataTable pattern push — 2026-07-18 (lead, hands-on)

Running checklist for the NYS-147 "DO NOW" tranche, built directly on
`components/ui/data-table.tsx` + `/networks` (the stacked full-feature
reference). Rule: **nothing is "done" without an after-screenshot re-checked
against the item's intent.** States: `[ ] open · [~] building ·
[✓] done+verified · [✗] dropped (say why)`.

Binding rulings in force: exact-rate-first (NYS-37/35 — exact figure at the
leaf, no median column), primitives law absolute, one H1 in the TopBar,
table-overflow containment (min-w-0 ancestors).

## Checklist

### 1. Per-column header menu (NYS-147 §1)
- [✓] 1.1 Click any header → menu: Sort asc / Sort desc (when sortable, active
      state shown), Filter by value (when the column declares `filterValue`),
      Hide column (when picker-enabled). Built from DropdownMenu/MenuItem —
      no new primitive.
- [✓] 1.2 Active column filters render as clearable FilterChips in the
      toolbar; filtering composes with search + sort.
- [✓] 1.3 DropdownMenu refinement: scrolling INSIDE a menu must not dismiss
      it (today `scroll` capture closes on any scroll — a bug for scrollable
      filter lists).
- [✓] 1.4 Right-click column picker + ColumnPicker chip unchanged.
- [✓] 1.5 After-screenshot: header menu open on /networks, one filter applied,
      chip visible — re-checked against "the canonical add/remove-column +
      sort from the header".

### 2. Empty-cell-as-CTA (NYS-147 §2)
- [✓] 2.1 `EmptyCell` helper exported from data-table.tsx: quiet semantic
      label, optional action (label + onClick/href) — never a blank cell,
      never a bare "—".
- [✓] 2.2 /networks adopts it: Administrator empty → "Insurer-run" (true
      statement from sql/044 semantics), Notes empty → quiet "No notes".
- [✓] 2.3 After-screenshot re-checked against "a missing value renders a
      label/action, never blank".

### 3. Status tabs with counts (NYS-147 §4)
- [✓] 3.1 /networks gains All / Networks / Products tabs (kind dimension,
      35/34 split live) with count badges — existing Tabs primitive
      (`count` + slideActive), composed above the card. No DataTable change.
- [✓] 3.2 Counts respect search/filters (tabs show what you'd get).
- [✓] 3.3 After-screenshot re-checked against "All 47 / Failing 4 above the
      table".

### 4. Floating bulk-action bar (NYS-147 §3)
- [✓] 4.1 DataTable `bulkActions` slot: navy floating pill, bottom-center,
      "N selected · [actions] · Clear", slide-up 200ms ease-out +
      reduced-motion instant. Appears only when selection is non-empty.
- [✓] 4.2 /networks wires a REAL action: Export selected → CSV download
      (and the toolbar Export exports the current view for real — kill the
      "isn't wired up yet" toast).
- [✓] 4.3 After-screenshot with 2+ rows selected re-checked against
      "N selected · Archive · Delete" partner-to-select-column intent.

### 5. Group-by count-header tree (NYS-147 §5 — the core)
- [✓] 5.1 DataTable `groupBy`: collapsible group-header rows with counts,
      multi-level capable, same columns top to bottom; sort orders groups by
      their leader / leaves within.
- [✓] 5.2 /networks: group by Insurer (15 groups) — count headers live.
- [✓] 5.3 (EXCEEDED — gate BUILT, not just recorded) Org leaf level (Insurer→Network→Org, exact figure at the leaf, no
      median column) — DATA GATE: needs the org × network exact-rate read
      (UI-PUSH item 2.1 matview). Record the decision; do not fake it with
      bands.
- [✓] 5.4 After-screenshot re-checked against NFS information-design
      reference (counts on group headers, chips showing active Group state).

### 6. Close-out
- [✓] 6.1 Typecheck clean; /design-system DataTable card updated if props
      changed; catalog note.
- [✓] 6.2 ui-agent handoff brief (scale to Find-my-plan NYS-37, /plans
      NYS-39, /orgs, NYS-148 record shape).
- [ ] 6.3 Commit (own files only), report, Linear comment on NYS-147.

## Decisions log (append as they happen)

- 2026-07-18: /networks' hand-rolled `NetworkFilter` popover (a one-off) is
  RETIRED in favor of the header-menu filter + toolbar chips — one mechanism,
  primitives only.
- 2026-07-18: header click now opens the menu (sort moves inside it) — the
  img-64 canonical. SortableHead stays exported for non-DataTable tables.

- 2026-07-18: the data gate OPENED — sql/048 `org_network_rates` built live
  (38.6s, 603,345 rows, 39 networks × 32,167 orgs), registered in
  sync-plan.mjs (cross-seam, one additive line — announced). Read path
  17s → 21ms. Finding with teeth: 57% of (org × network × code) leaves are
  single-rate (rate_single = THE exact figure); the rest are per-NPI
  contract tiers → surfaces drill to the provider grain, never summarize.
- 2026-07-18: /networks gained the real "Orgs priced" column (90837 anchor)
  — EmptyCell "No rates" is the honest missing-rate cell from the ruling.
- 2026-07-18: scale-out handed to ui-agent: docs/TASK-DATATABLE-SCALEOUT.md.

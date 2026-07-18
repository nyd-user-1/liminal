# 2026-07-18 — DataTable pattern push (lead, hands-on) — NYS-147 DO-NOW + the tree

The founder asked the lead to build the dashboard template personally before
delegating. All four NYS-147 "DO NOW" items plus the core group-by
count-header tree are live on the shared `components/ui/data-table.tsx` with
**/networks as the reference implementation** — and the tree's data gate
didn't just get recorded, it got BUILT (sql/048). Checklist:
`docs/UI-DATATABLE-2026-07-18.md` (every item screenshot-verified).
Scale-out brief for ui-agent: `docs/TASK-DATATABLE-SCALEOUT.md`.

## What shipped (one commit)

1. **Per-column header menu (NYS-147 §1).** Click any header → Sort asc/desc
   (active state shown) · Filter by value · Hide column. Columns opt into
   filtering with `filterValue`; active filters render as clearable
   FilterChips in the toolbar; filtered-to-zero renders a teaching row with
   a "Clear filters" action. Right-click column picker unchanged. Built from
   DropdownMenu/MenuItem/Checkbox/FilterChip — zero new primitives.
2. **Empty-cell-as-CTA (§2).** `EmptyCell` exported from data-table.tsx:
   quiet semantic label or an action, never a blank, never a bare "—".
   /networks: Administrator ∅ → "Insurer-run" (true per sql/044 semantics),
   Notes ∅ → "No notes", and the new Orgs-priced column ∅ → "No rates".
3. **Status tabs with counts (§4).** /networks: All 69 / Networks 34 /
   Products 35 — existing Tabs primitive (`count` + slideActive), counts
   read the searched set so each tab advertises what clicking shows.
4. **Floating bulk-action bar (§3).** `bulkActions` + `BulkAction`: navy
   pill bottom-center ("N selected · … · ×"), 220ms rise + reduced-motion
   fallback. /networks wires REAL actions: Export CSV (selected) + Copy
   names — and the toolbar Export now really exports the current view
   (the "isn't wired up yet" toast is dead).
5. **The group-by count-header tree (§5, the core).** `groupBy` on
   DataTable: multi-level, collapsible count headers, same columns top to
   bottom, group order flips only when the sort IS the grouped dimension,
   "Group · …" chip flattens/re-applies. /networks groups by Insurer (15
   count headers, live).

Supporting refinements: `useSort` tuple gains explicit `setSort`
(non-breaking); DropdownMenu no longer dismisses on scrolls originating
inside the menu (was a real bug for any scrollable menu list). One-off
killed: /networks' hand-rolled `NetworkFilter` popover.

## The data gate — sql/048 `org_network_rates` (built live)

A live org×network×code query measured **17s** — so the matview the UI-PUSH
checklist called for now exists: one row per (canonical network × billing
TIN × billing code) through the sql/044 alias layer (deduped join),
**603,345 rows · 39 networks · 32,167 orgs · built in 38.6s**, plain-column
unique key (NYS-88-safe), registered in `ops/harvest/sync-plan.mjs` so both
executors refresh it nightly. Read path after: **21ms**.

**Finding with teeth (binding on every exact-rate surface):** 57% of leaves
are single-rate — `rate_single` IS the exact attested figure. The remainder
are **per-NPI contract tiers** (probed: same org, same code, same setting,
three NPIs, three figures; only 1.5% of Aetna Choice POS II orgs are
single-rate at 90837). So org-level display uses n_rates honesty and the
exact figure for multi-rate orgs lives at the provider grain — surfaces
drill, never summarize. No median column exists anywhere in the view.

Repo reads shipped in `lib/repos/networks.ts`: `listNetworkOrgRates`
(network × code → org leaves, ~21ms) + `networkOrgCounts` (the /networks
"Orgs priced" column, anchor code 90837 — Aetna Choice POS II shows 14,066
priced orgs; products with nothing resolving show the honest "No rates").

## Verification

Headless drives at :3010 (cookie login, system Chrome), screenshots
re-checked against each item's intent per the founder's method: resting,
header menu open, filter checked, chip standalone, bulk bar with 2 selected,
Products tab, sort-desc via menu, grouped tree, collapsed group, flattened
via chip, Orgs-priced column. **Zero console errors, zero page-level
horizontal overflow (0px) in every state.** `tsc --noEmit` clean. Matview
numbers verified by live psql (counts + timings quoted above).

## Seams

- Staged only my hunks. `components/rates/*` (another session's uncommitted
  work) and `docs/UI-PUSH-2026-07-18.md` untouched.
- **Cross-seam, announced:** one additive line in `ops/harvest/sync-plan.mjs`
  (ops-agent's file) — that file's whole design is "add a matview once,
  both executors pick it up"; order-independent, appended last.
- **sql range: 048 consumed** (was free per ops-T2's ledger; 042–047 =
  data-agent). Remaining free below 060: 049, 051–059.
- /design-system copy-manifest updated with the header-menu/tree/bulk-bar/
  EmptyCell standard; reference impl named.

## Flags for the founder

1. **Push remains double-blocked** (unchanged, needs you): `! gh auth
   refresh -h github.com -s workflow` to unblock ALL pushes (belt + 5 data
   commits + networks + this work), then the `DATABASE_URL` repo secret for
   the belt to do real work.
2. **Anchor code 90837** for the /networks Orgs-priced column is my call —
   a code selector belongs on the rate-index page (ui-agent brief), not
   this column.
3. The tree defaults /networks to grouped-by-insurer; the chip's × flattens
   it. If the flat table should be the default, it's a one-word change.

## Next

ui-agent executes `docs/TASK-DATATABLE-SCALEOUT.md`: the rate-index tree
surface (exact figure at the leaf, provider drill), Find-my-plan (NYS-37),
/plans (NYS-39) + /orgs adoption, the NYS-148 near-term slice (tab count
badges + RelatedLink card fields), /directory port (NYS-127). Set-aside
NYS-147 items (drawer, filter builder, Paylocity expandable dashboard)
stay parked until the scale-out lands.

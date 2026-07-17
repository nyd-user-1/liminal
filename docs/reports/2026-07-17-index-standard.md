# 2026-07-17 — Index standard: portable object tables
Commit `3a6f695`, local only, not pushed. Linear: NYS-75.

## Shipped
- **Four object tables** — `components/tables/{clients,prescriptions,orders,catalog}-table.tsx`,
  each owning its DataTable, columns, toolbar, filters, detail panel and data
  wiring. Mounted twice: by its own route, and by the Clients rail.
- **/clients rail** — [All Clients · Prescriptions · Orders · Catalog] swaps those
  components **in place** (/directory's Providers/Programs model), not routing.
  `clients-index.tsx` is now chrome only: TopBar actions, rail, active table.
- **/clients toolbar restored to `e87fd62`** — search left, then Filter · Columns ·
  Export · Refresh; c3193ae's two-level categorised filter menu kept, under the
  Filter button. Teal funnel pill, standalone "+ Tags" chip and round ＋ are gone.
- **Three thin shells** — /prescriptions, /orders, /catalog are TopBar actions + a
  one-tab heading row + the table; the "Tab 2/3/4" placeholders are gone.
- **Two API twins** — `GET /api/photon/orders/all` (new; role-scoped + audited,
  mirroring the prescriptions one) and `GET /api/photon/catalog` (org config →
  unaudited, unscoped). They let a table load its own rows when a host mounts it
  without any, so /clients pays for Photon only when the tab opens.
- `AddTreatmentPanel` → `components/photon/`, beside the other panels.
- Verified on :3010: brendan (admin) 18 clients / 4 rx / 3 orders; shelley
  (practitioner) 3 / 1 / 1 — scoping holds through the new orders twin, the
  Practitioner column stays admin-only. `npx tsc --noEmit` clean.

## DB changes — none.

## Decisions
- **Route tabs withdrawn by the lead mid-session**; the rail swaps tables in place.
  The uncommitted experiment had the right shape, wrong implementation (inline
  duplicate table + fetch) — reverted, after snapshotting to the session
  scratchpad (`experiment-snapshot/`, incl. a patch that re-applies it to HEAD).
- `scope` is on the PHI lists only (prescriptions, orders — narrow to one client).
  Clients' scope is already `isAdmin`; a catalog is org-level config, so it has none.
- **/catalog has no Filter button** — one column, no facet; its search covers it.
- Staged `app/api/photon/prescriptions/all/route.ts` though another session created
  it: the tables depend on it and the commit would not build without it.

## Open items
Linear (NYS): this work is **NYS-75**, closed. Open items filed as their own tickets.
1. **NYS-76 — §2 IndexHeader + /design-system docs, not done.** Every shell is now
   literally `TopBarActions + Tabs`, so the primitive is a mechanical extraction.
2. **NYS-77 — §3 sweep not started**: /directory, /orgs, /orgs/registry, /plans,
   /recruiting, /billing, /library. Blocked on NYS-76.
3. **NYS-78 (high) — Export/Refresh drift.** Another session's uncommitted
   `data-table.tsx` restyles them `secondary` → `ghost`, i.e. away from e87fd62's
   "quiet outline buttons", on *every* index page at once. Not mine to stage; needs a call.
4. **NYS-79 (low) — tidy-up.** `components/photon/prescriptions-table.tsx` is now a
   dead duplicate (no importers), untracked and another session's, so left in place
   rather than deleted. Plus `clients-table.tsx` imports
   `@/app/(app)/clients/{ui,new-client-panel}` — backwards; both want
   `components/clients/`.

## Gotchas
- **The drift was never in `c3193ae`.** HEAD already matched e87fd62 byte-for-byte on
  toolbar anatomy with the two-level menu under Filter. Everything the brief
  attributed to the filter-menu commit was uncommitted working-tree work from
  ~23:11 the night before, entangled with the Photon section-tab experiment.
- The shared primitives (`tabs`, `data-table`, `filter-chip`, `icons`, `column-picker`,
  `page-header`) still carry that session's uncommitted edits. This commit excludes
  them deliberately and uses only props that exist at HEAD, so it builds standalone.

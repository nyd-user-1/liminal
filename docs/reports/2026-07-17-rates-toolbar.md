# /rates Services toolbar recomposition — for the lead

**Session:** A/board-grid (reassigned live by the founder — "gave this to the lead
but it's busy"). **Commit:** `0fdae7b` (local, NOT pushed). **tsc:** clean.

The founder handed this over with four annotated screenshots. /rates is normally
another session's domain (DO-NOT-TOUCH on my dispatches); this was a direct
reassignment, so I took it. Rates files were clean at start (no live collision).

## Shipped
The Services (rates) toolbar, recomposed to the founder's layout:

```
[ search ]   [ ✓ Rates | Bands ]   [ ☰ Filter ] ·················· [ ⋯ ]
```
- **Search moved inline**, leading the toolbar (was full-width above it).
- **Rates/Bands switch** sits beside the search — lifted out of the blurb row.
  rates-shell still owns the state and passes the toggle into whichever panel is
  showing (ServicesPanel AND BandsPanel), so it survives the Rates↔Bands swap.
- **One two-level Filter** replaces the three Insurer/Plan/Code chips: dimension
  first, values behind it in a **searchable** submenu (the founder's Image #4).
- **Columns + Export** fold into a right-aligned **horizontal kebab** (⋯).

## New / changed primitives (declared, per the one rule)
- **NEW `components/ui/filter-menu.tsx`** — the two-level filter, promoted to the
  kit. It merges two things that already existed but never together: the
  category→submenu structure hand-rolled inside `clients-table.tsx`, and the
  searchable value list from the rates `ChipMenu` (Image #4). One active value
  **per category** (Insurer AND Code at once) — the clients original was
  single-select only. Composes `FilterChip` + `SearchInput`. On /design-system.
- **`DataTable` gains opt-in `collapseActions`** — folds Columns/Export/Refresh
  into one horizontal `KebabMenu`; the "Columns" item opens the existing anchored
  `ColumnPicker`. Opt-in, so every other table in the app is byte-identical.

## Decision the founder made (recorded)
Filter categories = **Insurer, Plan, Code only** — the three real facets on
`/api/rates/services` (`payer`, `network`, `code`). **"Band" and "Rate" were left
out**: I checked the API and neither is a filterable facet (nor is Setting), so
there is nothing to build them from without backend work. The founder chose this
explicitly (Option 1) over building new facets.

## Verification
Real Chrome on :3010, signed in as brendan. The layout renders exactly as
specced (screenshots in scratchpad: `rates-toolbar.png`, `rates-filter-open.png`);
the two-level Filter opens Insurer/Plan/Code and its searchable submenu; selecting
Code narrows the table (90791 → 90837, confirmed by a settle-polled re-read); the
kebab exposes Columns + Export; the toggle survives the panel swap; no page-level
h-scroll. A full-row dump confirmed the table stays well-formed (8 columns, Code at
index 2). tsc clean. (4 checks in the first harness run were timing flakes reading
rows mid-fetch — chased down and disproven, not product bugs.)

## Open work — tickets filed (see Linear)
1. **Migrate `clients-table.tsx`'s local `FilterMenu` to the new kit primitive.**
   Its second level would gain search (an improvement), so it's a near drop-in but
   a behavior change on another surface — I did NOT touch it mid-session. This is
   the "replace hand-rolled copies" half of the extraction. Commented on NYS-92.
2. **"Band" / "Rate" as filter dimensions** — deferred per the founder's Option 1.
   If wanted later, needs new API facets + a definition of each (band = percentile
   bucket? rate = $ range?). Filed as its own ticket, backlog.
3. **`collapseActions` is now available** for other dense analytical tables that
   want the same kebab treatment — noted, not applied anywhere else.

## Files (all in `0fdae7b`, explicit-path commit)
`components/ui/filter-menu.tsx` (new), `components/ui/data-table.tsx`,
`components/rates/{services,rates-shell,bands}-panel.tsx`,
`app/(app)/design-system/page.tsx`.

## Notes for the lead
- **Not pushed** — local commit, per the standing rule.
- The old rates `ChipMenu` stays: it's the single-facet chip used across ~15
  surfaces (bands-panel, prescriptions, orders, orgs, …). FilterMenu is the
  multi-facet consolidation, not its replacement.
- Only the **Services** tab was restructured (that's what the screenshots showed).
  The other rates tabs (Panels, Roster, Apply next, Spread) are untouched.

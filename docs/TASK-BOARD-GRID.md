# TASK A — BoardGrid/BoardCard primitives: hq's grid interactions, extracted

The /analytics board shipped well but never actually took hq's grid
interaction language, and its card/grid code is welded to metrics. This task
extracts a GENERIC board (grid + card) into the design system with the full
hq affordance pack, then refactors /analytics onto it. This is the foundation
for the client-record board (TASK-CLIENT-BOARD.md runs after this) — build it
generic, ship it under /analytics.

READ THE HQ CODE FIRST — it is the spec for feel, not just a mood board:
`~/Code/hq/app/ui/draggable-card.tsx`, `fleet-grid.tsx`, `fleet-view.tsx`,
`pane-drop-zone.tsx`. Then read what exists here:
`components/analytics/{board,metric-card}.tsx` (drag/reorder, size ladder
sm|md|lg, localStorage persistence, corner resize handle already exist).

## 1 — New primitives: `components/board/board-grid.tsx` + `board-card.tsx`
Generic over `ReactNode` content — NOTHING metric-specific. API sketch (adapt
as the extraction demands, but keep it dumb):
- BoardGrid: items (ids in order), sizes map, onReorder, onResize(id, dir|cycle),
  onRemove, renderCard(id), grid classes (the analytics 4-col grid is the default).
- BoardCard: title, kebab/menu slot, children, size, and the INTERACTION PACK below.

## 2 — The interaction pack (this is the point — mirror hq, translated light)
- **Hover state**: card lights up with a discrete 1px border (primary at low
  alpha — the current hover:border-primary is close; verify it reads as 1px
  quiet, not loud) AND the cursor over any non-interactive surface becomes
  `grab` (`cursor-grabbing` while dragging). The WHOLE CARD is the drag
  surface — not a hidden dots button; interactive children (links, buttons,
  inputs, the kebab) opt out naturally because pointer-down on them never
  starts a drag.
- **Hover corner affordances** (fade in on card hover, like hq's):
  · top-LEFT: × remove.
  · top-RIGHT: ⠿ drag-handle glyph with a "drag to move" tooltip — it signals
    the whole-card drag; dragging from it also works.
  · bottom-RIGHT: the resize glyph (exists — carry it over) with its
    drag-out/drag-in/click behavior.
- **Tooltip** "click and hold to drag" on first hover of the card body (hq
  shows this centered near the pointer — mirror their trigger/timing).
- Keep HTML5 DnD or move to pointer events — whichever hq's feel demands;
  the reorder-on-drop behavior and localStorage persistence must not regress.

## 3 — Refactor /analytics onto the primitives
`components/analytics/board.tsx` becomes composition: metric bodies render
inside BoardCard; kebab keeps About/Resize/Open/Remove; KPI library panel,
views, dictionary — all unchanged behavior. The ONLY user-visible change on
/analytics is the new affordances (grab cursor, corner icons, tooltip,
hover border). Zero regression on: drag-in from library, click-to-add,
reorder, resize ladder, remove, view apply/save, layout persistence.

## Out of scope
Client record (next brief). New metrics. Dark styling. Any index page.

## Done when
1. /analytics behaves exactly as before PLUS: grab cursor + 1px hover border,
   × top-left, ⠿ top-right w/ tooltip, resize glyph bottom-right, hold-to-drag
   tooltip.
2. BoardGrid/BoardCard have no imports from components/analytics or
   lib/analytics — provably generic.
3. `npx tsc --noEmit` clean; verify interactions in a real browser session on
   :3010 (headless driving is fine) — drag, resize, remove, add, reload.
4. /design-system gains a BoardCard/BoardGrid card (this is a new primitive —
   flagged deliberately, per the house rule that new primitives are declared).

## Working agreements
Stage ONLY your own files (never -A; concurrent sessions share the tree).
Commit locally; do NOT push. Report to
`docs/reports/2026-07-17-board-grid.md`, 60-line cap: Shipped / DB changes /
Decisions / Open items / Gotchas.
Linear (NYS team): file a ticket at start, close on done; Open items get
their own tickets. No access → say so in the report.

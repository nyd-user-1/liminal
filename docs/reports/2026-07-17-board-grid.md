# BoardGrid / BoardCard — hq's grid interactions, extracted (NYS-73)

## Shipped
- **`components/board/board-grid.tsx`** — new primitive (declared deliberately, per the house
  rule). Flow grid + reorder drag. Props: `items`, `size(id)`, `onReorder`, `renderCard(id)`,
  `className`/`span`/`height` (4-col default). Also exports `reorderIds()` and `useBoardCardDrag()`.
- **`components/board/board-card.tsx`** — new primitive. Card chrome + the affordance pack.
- **The pack**, from hq's `fleet-grid.tsx`: whole card is the drag surface with hq's
  click-and-hold engage (150ms **or** 4px travel, first to land); `grab`/`grabbing` cursors; 1px
  primary hover border; × top-left; ⠿ grip top-right (own tooltip, skips the hold); resize glyph
  bottom-right (drag-out/in, click-cycles); "Click and hold to drag" on the body; lit drop target.
- **`/analytics` refactored onto it** — `board.tsx` is now composition (−108 lines): placed metrics,
  size ladder, views, persistence. `metric-card.tsx` is a `BoardCard` + a metric body (−70).
  No user-visible change beyond the new affordances.
- **`/design-system`** gains a live, interactive `BoardGrid / BoardCard` card under Layout & brand.

## DB changes
None — UI only. No repo, route, schema, or migration touched.

## Decisions
- **Pointer events, not HTML5 DnD, for reorder.** hq's feel *is* the hold-to-engage, and HTML5 DnD
  starts on the first pixel — a tooltip saying "click and hold" over a thing that doesn't hold is a
  lie. Library drag-in stays HTML5 DnD; no collision (no pointer events fire during an HTML5 drag).
- **Genericity is structural.** `components/board/` imports only React, `Card`, `Icon`. Drag state
  reaches the card via a context BoardGrid publishes per card, so `BoardCard` needs no id and works
  standalone as a static card. Only "analytics" in the dir is a comment.
- **Deviations from the brief's API sketch** (it invited adapting): `onResize`/`onRemove` sit on
  `BoardCard`, not `BoardGrid` — the grid renders no chrome, so routing them through it is a
  pass-through to nothing. A `size(id)` resolver replaced `sizes` map + fallback (the caller owns
  both). No `size` prop on `BoardCard`: the grid owns span/height.
- **× rides the corner (−left-2 −top-2).** hq's inside-corner × lands on the title on a light card.
- **`select-none` on the card**, mirroring hq — else a hold-drag smears a text selection across the
  board. Cost: metric-table text isn't selectable. The one deliberate ergonomic trade in the pack.
- **Tooltips are the native `title`** — literally what hq uses (`fleet-grid.tsx:259`). No new primitive.
- **Fixed in passing: dragging a card one slot right did nothing.** The old rule spliced *ahead of*
  the target — a no-op against your right neighbour. `reorderIds()` lands the card on the target's
  far side: after when dragging right, before when dragging left. Both directions move now.
- **`!border-primary` / `!bg-primary-wash` for the drop state.** `Card` ships `border-border`/
  `bg-surface`; equal specificity loses on Tailwind's emit order and the highlight silently never
  rendered. Same reason the card already had `!p-4`.

## Verification
30/30 driven in real Chrome on :3010 (headless, `playwright-core` + system Chrome), signed in as the
practitioner: grab cursor, 1px primary border (`rgb(63,130,144)`), all three affordances present *and*
in the correct corners, both tooltips, hold-drag reorder, grip reorder, lit drop target, **plain click
never nudges the board**, kebab still opens (drag never steals it), resize drag-out/in stepping the
ladder, × remove, click-to-add, view apply, view save, Reset, and order/size/removal each surviving
reload — plus the `/design-system` demo rendering and reordering. `npx tsc --noEmit` clean.

## Open items
- **NYS-74 — drag-in from the KPI library can never drop (pre-existing, medium).** `SidePanel` is a
  modal: a `fixed inset-0 z-50` scrim covers the board, so a metric dragged out of the library drops
  on the scrim and `addMetric` never fires. **Not a regression** — I stashed this refactor and measured
  HEAD: identical (10 → 10 cards; `elementFromPoint` over a board card returns the scrim in both).
  Click-to-add works, which is why it went unnoticed. The rows still advertise `draggable` + the
  DRAG_TYPE handshake, so the UI promises an interaction it can't deliver. Three fix directions in the
  ticket; it needs a design call, so I left it rather than pick one inside this brief's scope.
- Dead `commit()` in `board.tsx` — unused before this change, untouched.

## Gotchas (for TASK-CLIENT-BOARD)
- Use `reorderIds()`; don't re-derive the splice. Any `bg-*`/`border-*` passed through `BoardCard`'s
  `className` needs `!` to beat `Card`. The pack only exists inside a `BoardGrid` — that's the context.
- `touch-none` is on the grip/resize only (hq's choice), so whole-card hold-drag won't engage on touch
  — page scrolling wins. Desktop board, as briefed.
- `data-board-card={id}` is both the drop hit-test target and the browser-test hook (replaced `data-card`).

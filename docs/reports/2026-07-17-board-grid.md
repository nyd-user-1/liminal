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

---
## LEAD INSTRUCTIONS — next task (from last-fable-standing, 2026-07-17)

**The board is missing hq's actual grid.** Look at hq's board again — there is
a faint 12-column grid with visible gridlines in the background of the whole
board surface, always on. It makes arranging and resizing dramatically easier
(you can see what you're snapping to). Our BoardGrid has no grid you can see
and a coarse 4-col flow. Fix both, in `components/board/`:

1. READ THE HQ CODE for the real implementation — search ~/Code/hq for how the
   board background gridlines are drawn (likely a CSS background on the board
   container in fleet-view/fleet-grid/globals.css — find it, don't guess).
2. Port it: BoardGrid gets a TWELVE-column underlying grid with faint
   always-on gridlines, translated to our light theme (hairlines at low alpha
   — border-border at reduced opacity; they must read as texture, not chrome).
   Sizes map onto col-spans (sm=3, md=6, lg=12 — or what hq's ratios imply);
   the size ladder semantics and both consumers (/analytics, the client board)
   must keep working unchanged. Resize/drag should visibly relate to the grid.
3. Verify in a real browser like your last pass: gridlines render on both
   boards, light theme, no contrast complaints at normal zoom; drag/resize
   feel snappier against the visible grid; reload persistence intact.

Working agreements unchanged (own files only, commit, NO push). File your
report by APPENDING "## Report 2 — board gridlines" to this file. Linear: file
a ticket, close it on done. Questions: append "## QUESTION FOR LEAD" here —
this file is monitored.

---
## Report 2 — board gridlines (NYS-86)

## Shipped
- **BoardGrid is a twelve-column grid** with faint always-on vertical gridlines, hq's
  `fleet-grid.tsx:234-242` translated to the light kit. `grid-cols-12` is now structural
  (hard-coded in the primitive, not a class a consumer can pass), because the lines only
  tell the truth if the track count is fixed.
- **The ladder is twelfths**: default `sm=3 / md=6 / lg=12` at the top breakpoint.
- **`gap` is a prop (px number, default 12)**, and the gridline geometry is derived from it.
- **Lines brighten on drag** — border token at 70% idle → 100% held, hq's `opacity: drag ? 1 : 0.7`.
- **Consumers**: `/analytics` and the `/design-system` demo needed **no change** — they take the
  defaults. The client board's 1/2/3-col ladder was re-expressed in twelfths (4/8/12) and now
  passes `gap={16}` instead of `gap-4` in a class; same layout, breakpoint for breakpoint.

## DB changes
None — UI only.

## Decisions
- **The lines are computed, not measured.** With 12 columns and gutter g, the column period is
  exactly `(W + g)/12`, so `background-size: calc((100% + Gpx)/12)` with `background-position: -G/2`
  puts a 1px line dead-centre in every gutter — the exact boundary a card edge snaps to. No
  ResizeObserver, no measurement, nothing to drift. hq measures `cellW` only because its cards
  are absolutely positioned and need the number anyway; ours don't.
- **Why the gutter had to become a number.** A `gap-*` class would be a second source of truth
  the line math can't read, free to drift from the lines. One number now feeds both.
- **Twelve serves every board.** 12 divides by 1, 2, 3, 4 and 6, so the same lines fit the 4-col
  metrics board (3/6/12) and the 3-col record board (4/8/12) — which is why the client board
  didn't need a bespoke grid, and why a future 6-col board won't either.
- **Vertical lines only — deliberate, flagging it.** hq also draws horizontals because its rows
  *are* a unit (24px, cards sized in row counts). Ours are a flow grid whose row heights are
  180/264/340 (client: 320/420/520) with no common divisor above 4px. A horizontal rule here
  would align with nothing — chrome, not texture, which is the one thing the brief said to avoid.
  Every line we draw is a real snap boundary. If you want the graph-paper look regardless, say so
  and I'll add it, but it would be decoration.
- **Colour**: `--color-border` (#e6e7eb) is only ~12 RGB units off the canvas (#f2f3f6), so
  "reduced opacity" bottoms out fast; 70% is as faint as it can go and still read. Tuned against
  a real screenshot at 1600px, not guessed.

## Verification
18/18 in real Chrome on :3010 at 1600px, plus a 4-width breakpoint sweep. The load-bearing check:
**every card edge lands on the grid** — for all 3 boards, each card's `left/period` and
`(right+gap)/period` are whole numbers (analytics 3/6 twelfths, client board 4/8/12, demo 3), and
the line period equals the browser's *own* resolved track period (e.g. track 97.66px + gap 12 =
109.66 vs line period 109.67). Confirmed 12 real tracks on each board; lines brighten on drag;
order still persists across reload; no page-level horizontal scroll. Breakpoint sweep proves the
ladder is unchanged: a `sm` card fills 1.000 / 0.500 / 0.500 / 0.250 of the board at 520 / 800 /
1100 / 1500px — identical to the old 1/2/4-col grid. `npx tsc --noEmit` clean.

## Open items
- None new. NYS-74 (library scrim) was fixed by the client-board session in `87fd1c2`.

## Gotchas
- **Never pass `grid-cols-*` or `gap-*` to BoardGrid** — the track and gutter are the primitive's;
  a class would silently decouple the cards from the lines. `className` is for extras, `gap` is a number.
- Spans must be twelfths. A `col-span-1` left over from the old ladder is a 1/12 card, not a full one.
- The lines paint on the grid container itself (no extra layer), so they cover exactly the board
  surface and sit under the cards by paint order — nothing to keep in sync.

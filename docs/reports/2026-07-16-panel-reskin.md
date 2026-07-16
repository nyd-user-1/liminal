# 2026-07-16 — SidePanel reskin (hq spec-drawer anatomy)

## Shipped
- `components/ui/side-panel.tsx` — one-file reskin. Zero call-site edits; all 15
  consuming files / 22 instances compile untouched (`npx tsc --noEmit` clean).
  - **Flyover, not a slab.** 12px inset from the viewport, `rounded-card`, inset
    1px ring + high shadow (`--shadow-panel`) over a softer scrim.
  - **Kicker over title.** New OPTIONAL `kicker` prop → mono uppercase category
    line above a larger (22px) title. Absent → title alone, as before.
  - **Enter-only motion** (`.panel-in`, 200ms ease-out); dismiss instant.
  - **`variant="spec"`** — the faithful dark treatment (#0f1011 / #23252a ring /
    #8a8f98), also optional. It dropped out of the same structure as a token map.
- `app/globals.css` — `--color-scrim-soft`, `--shadow-panel`,
  `--shadow-panel-spec`, `@keyframes panel-in` / `panel-scrim-in`,
  `.panel-in` / `.panel-scrim-in` / `.panel-sheet-in` (+ reduced-motion).
- `app/(app)/design-system/page.tsx` — SidePanel card documents the new anatomy
  and gained a second card demoing `variant="spec"`.

## DB changes
None.

## Decisions
- **Translation, not transplant.** Linear's `0 7px 32px #00000059` (35% black) is
  tuned for near-black chrome and reads as soot on a white shell → 0.18 for the
  light default; the spec variant keeps 0.35. Linear's white radial glow is
  invisible on white, so the light panel carries the same gesture in brand teal
  at 0.10.
- **New scrim token, not a changed one.** `bg-scrim` is shared with Modal,
  mobile-nav, booking-sheet and note-sheet; softening it in place would have hit
  all four. `--color-scrim-soft` is SidePanel-only. (Task forbids touching Modal.)
- **Inset ring, not a border.** A 1px border would round independently of
  `rounded-card`; `inset 0 0 0 1px` keeps the radius exact. Same as Linear.
- **Inset via outer padding, not panel margin.** The panel's `h-full` must
  resolve against a bounded box — a margin would push it past the viewport by
  that margin. `mobileSheet` stays flush to the bottom below `lg` (a sheet with
  a gap under it reads as a bug) and takes the fly-in only at `lg`.
- **Icon square suppressed in `spec`** — an `#F3F4F6` chip on #0f1011 is a hole.

## Open items
- **`prescribe-panel` not verified live.** Its trigger is gated on
  `canConfigure = !!photonClientId && !!orgId` (`clients/[id]/rx-tab.tsx:96`);
  `orgId` comes from a live Photon M2M call that isn't resolving locally, so the
  button never renders. Environment, not the reskin — the panel is a plain
  `<SidePanel open onClose title icon width>` and inherits by construction.
- No consumer passes `kicker` yet, so every shipped panel renders title-only.
  Wiring the obvious ones ("CLIENT", "PRESCRIPTION", "PAYER") is a follow-up.
- `variant="spec"` has no consumer — built, documented, unused by design.

## Gotchas
- **Verified: 5/6 panels driven headlessly on :3010** (new-client, calendar
  appointment, catalog, billing payer, Rx detail) — each asserted radius 12px,
  gap 12/12, inset ring, body `overflow-y:auto`, pinned footer, Esc dismiss, and
  **no page-level horizontal scroll**. Screenshots in the session scratchpad.
- **`role="dialog"` is not a usable test selector here.** `mobile-nav` renders a
  permanently-mounted 0×0 dialog that wins `waitForSelector(..., {state:"visible"})`
  and hangs it forever. Target `.panel-scrim-in`.
- The spec panel *looks* washed-navy in a screenshot; sampled pixels are exactly
  `(15,16,17)` = #0f1011 with `(18,19,20)` at the glow. Trust the pixels.
- Sign-in is `/sign-in` (not `/login`); fields are `name=`, not `type=`.
- Committed with `git commit --only <paths>`: the shared index already held the
  other session's staged `components/shell/{app-shell,topbar}.tsx`, which a plain
  `git commit` would have swept into this commit. Their index is untouched.

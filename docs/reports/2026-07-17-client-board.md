# 2026-07-17 — The client record is a board
Commits `81fb34c` (checkpoint) + this one, local only, not pushed. Linear: NYS-80.

## Shipped
- **A client opens as a closable TAB in the /clients rail** — /directory's browser-tab
  model, no navigation. List tab intact, several clients open at once, ×-close falls
  back to the left neighbour. Open records stay mounted, so a board you rearranged is
  still arranged when you tab back.
- **`components/records/identity-card.tsx`** — NEW component, declared per the house
  rule. Generic by construction (config only; imports React, Card, Avatar — the rule
  `components/board/` follows), so the provider rail and /orgs can adopt it. Client
  visual language (muted label over value), provider dimensions (w-80, full height).
- **`components/records/client-record.tsx`** — the board: sticky rail + BoardGrid of
  **10 cards**. Default: Upcoming appointments · Billing summary · Rx · Insurance ·
  Files. Library also holds Personal, Documentation, Billing, Orders, Referrals.
- **`components/records/card-library-panel.tsx`** — the KPI-library pattern for a
  record: search, Care/Money/Records sections, ON BOARD / + ADD. Click-to-add **and**
  drag-in (see NYS-74 below). Generic over the catalog the host passes.
- **`GET /api/clients/[id]/record`** — the record's API twin (PHI read, audited),
  mirroring terminal B's twin pattern. Opening a tab is not a navigation, so the
  bundle comes over the wire; /clients pays for none of it until a row is clicked.
- **/clients/[id] still resolves** — it renders the rail with that client open and
  server-renders the bundle, so a bookmark paints with data, not a spinner. Card keys
  ARE the old tab keys, so every `?tab=rx|personal|billing|documentation|insurance|
  files` link still lands on what it named; a card this browser removed is put back.
- **NYS-74 FIXED, including at its origin.** `SidePanel` gained `dragThrough`: the
  scrim passes pointer events through *while a drag is in flight*, the panel keeps
  them. Applied to the card library and to the analytics KPI library — that board now
  measures 10 → 11 cards on a drag-in where NYS-73 measured 10 → 10.
- Layout persists per user per record TYPE (one arrangement for every client), card
  KEYS only — no client data reaches localStorage.

## DB changes — none. No repo, schema or migration touched.

## Decisions
- **`bare` is the re-housing seam.** The old tabs are page *sections*: each draws its
  own `<h2>` and box, so in a card you get a title inside a title. `bare` drops only
  that chrome; internals are untouched and every caller's default is off, so the
  portal is unchanged. Sections whose create flow is a plain trigger (Insurance,
  Billing) also take B's controlled `newOpen`/`onNewOpenChange`, and the button
  becomes card chrome. Documentation keeps its own: its action is a note-KIND picker,
  and lifting it would mean duplicating the kind list and `createNote` in the board.
- **OverviewTab was decomposed, not mounted.** The brief's default board names
  *Overview* AND *Upcoming appointments* AND *Billing summary* — but the last two live
  inside Overview, so they cannot all be cards without duplicating. Contact moved to
  the rail, so the tab's four sections are now four exports; `OverviewTab` still
  composes them exactly as before, which is what the portal renders. No "Overview" card.
- **The size ladder is board config, not a new BoardGrid step.** The brief floated
  `xl`; unnecessary — BoardGrid already takes `span`/`height`. Cards holding a
  DataTable (Rx, Orders, Billing) default to full width: their toolbar wants ~700px
  and half a board beside the rail is ~430px.
- **`rx-tab.tsx` deleted.** Its list is now B's `PrescriptionsTable` scoped to the
  client (per the lead); its prescribe + sync halves moved onto the Rx card, which is
  its only remaining consumer. Nothing imported it. The prescribe panel rides with the
  record, not the card, so it survives the card being resized or removed mid-write.

## Verification
Real Chrome on :3010. 11/11 board (default set, library, click-to-add, drag-in,
persistence, ×-remove, Reset), 24/24 final: every `?tab=` deep link, every old-tab
capability (prescribe, new policy, upload, new invoice, new note, contact kebab,
status picker), all 10 cards at once, no page-level horizontal scroll. brendan (All
Clients) · shelley (My Clients; Rx scoped to the one client) · casey (portal tabs,
Contact card and headings unchanged; no board). `npx tsc --noEmit` clean.

## Open items
1. **NYS-81 — Rx/Orders show a constant "Patient" column on a client record.** B's
   tables are right to have it; scoped to one client it is noise. Their API, their call.
2. **NYS-82 — `IdentityCard`'s field row duplicates `FieldDisplay`** (`app/(app)/
   clients/ui.tsx`). A generic component can't import a feature's helper; promote
   FieldDisplay to the kit when the provider rail adopts IdentityCard.
3. **NYS-83 — `components/billing/client-billing.tsx` is now unused** (the Billing card
   mounts its interactive half directly). Left in place: /design-system names it.
4. Provider-rail retrofit and other record pages: out of scope, as briefed.
5. Identity rail runs full-height with space under the fields — as briefed ("full
   height of the viewport column"); flagged at checkpoint, left as specified.

## Gotchas
- **`dragThrough` is for the length of a drag only.** A scrim that never captures is a
  panel you can't dismiss by clicking away. Set it in `onDragStart` **before** touching
  `dataTransfer` — if that throws, the guard never drops.
- Playwright's `dragAndDrop`/synthetic mouse does not drive HTML5 DnD here: its
  actionability check runs before React re-renders from `onDragStart`. Drive
  `dragstart`/`dragover`/`drop` with one `DataTransfer` handle instead.
- The record twin fires twice per open in dev (StrictMode double-effect) → two audit
  rows. Production runs effects once.
- `hasText: "Billing"` also matches "Billing summary" — exact-match library rows in tests.

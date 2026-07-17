# TASK C — Client record = a board: browser tab, sticky identity card, card grid

RUN ONLY AFTER TASK-BOARD-GRID.md HAS LANDED (it ships components/board/*)
and ideally after TASK-INDEX-STANDARD.md (shares the /clients rail). Read
both reports first (docs/reports/2026-07-17-{board-grid,index-standard}.md).

The idea, verbatim from Brendan: the client drill-down page is "pretty much
exactly like a dashboard but for the client" — instead of Add-metric it has
Add-card; instead of metrics, the cards are the client's files, forms, bills,
documents, invoices, insurance, orders. One layout for every record page,
starting here.

## 1 — The shell: browser-tab pattern, like providers
Clicking a client row on /clients opens the client as a CLOSABLE TAB in the
/clients tab rail — the exact model /directory already runs
(`app/(app)/directory/directory-client.tsx`: "Browser-tab model: each opened
provider is a closable tab"; read it and mirror the mechanics: open on row
click, activate, ×-close returns to the list, multiple clients open at once).
Keep deep-linking working: `/clients/[id]` still resolves (it can render the
list with that client's tab open, as directory does) — bookmarks, portal
links and `?tab=rx` references elsewhere in the app must not 404. Audit
`grep -rn "clients/" app/ components/` for link shapes and preserve them
(map `?tab=X` → scroll-to/ensure the matching card).

## 2 — The left rail: ONE identity card, client design, provider dimensions
Build the client identity card with the CLIENT card's visual language (muted
label over value pairs — Brendan prefers it to the provider card's bold
labels) but the PROVIDER card's dimensions: same narrow width, full height
of the viewport column. It is sticky/fixed; the big cards on the right
scroll up BEHIND the tab line and off screen while it stays. Contents: what
client-header + the Contact card hold today (avatar, name, status badge,
pronouns/DOB/age, email, phone, address, primary practitioner, tags).
Extract as `components/records/identity-card.tsx` with a config so the
provider rail can adopt the same primitive later — note that in the report,
don't retrofit providers now.

## 3 — The right side: BoardGrid of section cards
One large card per old tab, powered by the EXISTING tab components (do not
rewrite their internals — re-house them):
`app/(app)/clients/[id]/{overview,personal,rx,insurance,files}-tab.tsx` plus
Documentation and Billing (find them via client-tabs.tsx). Default board:
Overview, Upcoming appointments, Billing summary, Rx, Insurance, Files —
sensible sizes (these are LARGE cards; the sm|md|lg ladder may need an xl/
full-width step — add it to BoardGrid if so, generically).
- Cards use BoardCard: grab-drag, ⠿ handle, × remove, corner resize, hover
  border — all inherited.
- **Add card** button (top of the board, standard placement) opens the
  reskinned SidePanel as a CARD LIBRARY — the KPI-library pattern
  (components/analytics/kpi-library-panel.tsx is the reference): search,
  sections (Care, Money, Records…), rows with ON BOARD/+ADD state, click or
  drag onto the board.
- Layout persists per user per client-type (one layout for all clients, not
  per client — localStorage, same pattern as analytics views).
- PHI: layout state holds card KEYS only, never client data.

## CHECKPOINT — before building the section cards
Once §1 + §2 render (client opens as a closable tab, sticky identity card in
place, board area stubbed with one real card), STOP. Screenshot it at a real
width and show Brendan; wait for his go before building out the remaining
cards and the Add-card library. This is the design-risk moment — a layout
miss caught here costs minutes, at the end it costs the build.

## 4 — Don't lose function
Every capability reachable from the old tabs must be reachable on the board:
Rx tab's prescribe flow + detail panel, insurance add/edit, file upload,
invoice actions, notes/documentation entry points, contact-menu actions.
The tab-line badges (Insurance 2, Files 2) become card badges. Casey's
portal is UNTOUCHED (portal reuses some shared client components — check
`readOnly` paths still render; the Photon Phase-2 report warns readOnly
defaults false on 5 shared components).

## Out of scope
Provider rail retrofit. Other record pages (orgs, plans — they follow later
on the same primitives). New data queries beyond what tabs already fetch.
Editing IndexHeader/DataTable.

## Done when
1. /clients row click → client opens as a closable tab; list tab intact;
   multiple clients open; deep links + ?tab= references still work.
2. Sticky narrow full-height identity card (client visual language); board
   cards scroll behind the tab line.
3. Default board shows the six cards with real data; Add-card panel adds and
   drag-ins work; remove/resize/reorder/persist work; nothing from the old
   tabs is unreachable.
4. Verified on :3010 as brendan AND shelley (scoping) AND casey (portal
   unaffected); `npx tsc --noEmit` clean; no page-level horizontal scroll.

## Working agreements
Stage ONLY your own files/hunks. Commit locally; do NOT push. Never log PHI.
Report to `docs/reports/2026-07-17-client-board.md`, 60-line cap: Shipped /
DB changes / Decisions / Open items / Gotchas.
Linear (NYS team): file a ticket at start, close on done; Open items get
their own tickets. No access → say so in the report.

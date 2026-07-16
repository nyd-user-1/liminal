# TASK — Photon Phase 2: Rx detail, patient-portal Rx, /prescriptions /orders /catalog

Phase 1 (docs/TASK-PHOTON-DEMO.md + reports docs/reports/2026-07-1{4,5}-photon-demo*.md)
is live: real prescriptions exist in the Neutron sandbox (Peter Parker, Casey
Morgan; prescriber Brendan Stanton), orders are in "Routing / Pending
selection". `lib/photon.ts` (M2M token + GraphQL), the sync/read endpoints,
and the client Rx tab all work. This phase builds the missing UI. Everything
reads via the M2M server path — check the GraphQL schema at
docs.photon.health/reference before writing ANY query; never guess field
names. All demo data is fake; no PHI safeguards, but never log payloads.

## A — Rx row drill-down (provider, client Rx tab)
Clicking a prescription row currently does nothing. Make it open a detail
surface (SidePanel/sheet per house pattern) mirroring Photon's own detail:
medication, status badge, patient, written date, prescriber, instructions,
pharmacy notes, quantity ("30 Each / 30 day"), fills remaining/allowed,
effective, do-not-fill-before, expiration, dispense-as-written, external id,
plus **Pharmacy Orders for that prescription** (state e.g. "Routing —
pending pharmacy selection", created date, pharmacy once selected). New
endpoint `GET /api/photon/prescription?id=` (prescription by id + its
orders/fills). No cancel/renew actions this phase — read-only detail.

## B — Patient portal Rx UI (Casey's side has NOTHING today)
The portal (`app/(portal)/…` — read it first; portal pages mirror provider
shells, see handoff-2026-07-10 portal redesign) gets a "Medications" section:
sidebar entry + route, listing the signed-in client's own prescriptions
(medication, instructions, written, status) with the same read-only detail
as A, plus their orders: status, and **pharmacy**: show selected/preferred
pharmacy when set; while "pending selection", say so plainly ("Your pharmacy
choice is pending — check your text messages from Photon, or a preferred
pharmacy will be used/selected automatically"). IF AND ONLY IF the schema
reference documents a supported mutation for setting an order's pharmacy or
a patient's preferred pharmacy via M2M (e.g. pharmacy search + set), build a
minimal in-portal pharmacy picker (search by name/zip → select). If not
documented, ship the status display only and note it in the report — do not
improvise. Client sees ONLY their own data (photon_patient_id from their
clients row via session user).

## C — Provider pages: /prescriptions, /orders, /catalog
Three new practitioner routes in the app shell (add each to ROUTE_TITLES in
components/shell/topbar.tsx; add sidebar entries in the existing nav config,
grouped sensibly). ALL tables use the `DataTable` primitive
(components/ui/data-table.tsx) — sortable headers, column picker
(storageKey), single-row headers, table-owned scroll. Role: requireRole
practitioner (admin passes automatically). Practitioners see their own
clients' rows; admin sees all (same role logic as the clients list).
- **/prescriptions**: org-wide Rx list — medication + instructions,
  quantity, patient (links to client Rx tab), fills "0 of 1", status badge
  (Active=success tint, Depleted=warning, Expired/Cancelled=muted),
  prescriber, date written. Search by patient name; status filter chips.
- **/orders**: medication, patient, order state badge ("Routing"), pharmacy
  ("Pending selection" muted italic when none), created date. Row click →
  the A-style detail of its prescription.
- **/catalog**: manage the org treatment catalog (mirror Photon's page):
  list current catalog treatments, search-to-add from Photon's treatment
  search, remove. Add/remove ONLY if the schema documents catalog mutations
  for M2M; otherwise read-only list + report the gap. This powers what the
  prescribe workflow offers, so it's org-config, not PHI.

## D — Plumbing
- New repo/endpoint functions follow lib/photon.ts patterns; batched where
  possible; 60s in-module caches for list endpoints; normalize dates to ISO.
- Empty states everywhere (design-system EmptyState pattern). Statuses map
  to existing badge tints — no new colors.
- If an org-wide "all prescriptions/orders" query isn't documented, derive
  from synced patients' ids (13 patients) with the aliased-batch pattern
  already used by rx-counts.

## Out of scope
Prescribe-flow changes, webhooks wiring, cancel/renew mutations, auth
hardening, any rate/payer tables, redesign of existing tabs.

## Done when
1. Provider: clicking any Rx row (client tab, /prescriptions, /orders) shows
   the full detail incl. order status; Peter's Tylenol shows its two orders.
2. Casey's portal login shows her Medications page with her prescription,
   order status, and pharmacy state (picker only if API-supported).
3. /prescriptions, /orders, /catalog live in sidebar + TopBar titles, all on
   DataTable, no page-level horizontal scroll, single-row headers.
4. Verify on localhost:3010 as brendan (provider), shelley (practitioner
   scoping), casey (portal). Report which schema capabilities existed vs not.

## Working agreements
Stage only your own files; commit; do NOT push. Dev server may be running.
Never print secrets/tokens. Report to
`docs/reports/2026-07-15-photon-phase2.md`, 60-line cap, sections:
Shipped / DB changes / Decisions / Open items / Gotchas.

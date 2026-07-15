# 2026-07-15 — Photon Phase 2: Rx detail, portal Rx, /prescriptions /orders /catalog

## Shipped
`1bd5e87` — 22 files, executing `docs/TASK-PHOTON-PHASE2.md` A→D.
- **A** `app/api/photon/prescription/route.ts`, `components/photon/rx-detail-panel.tsx`,
  `app/(app)/clients/[id]/rx-tab.tsx` (M — rows now open the panel).
- **B** `app/portal/medications/{page.tsx,medications-list.tsx}`, `components/photon/pharmacy-picker.tsx`,
  `app/api/portal/pharmacy/route.ts`, `app/api/photon/pharmacies/route.ts`.
- **C** `app/(app)/{prescriptions,orders,catalog}/{page.tsx,*-index.tsx}`,
  `app/api/photon/{catalog,treatments}/route.ts`.
- **D** `lib/photon.ts` (M, +468), `lib/photon-scope.ts`, `components/photon/status.ts`, `components/shell/{app-shell.tsx,topbar.tsx}` (M — nav + ROUTE_TITLES).
- Verified :3010 — brendan 3 Rx/2 orders, shelley 1 Rx/1 order (Peter is Lena's), casey own only;
  cross-tenant Rx reads `403`; client→`/prescriptions` `307`. `tsc` clean; repo has no ESLint config.

## DB changes
**None.** No migration, no table/matview, no rows written. Postgres untouched.
Photon sandbox writes were capability tests only, each reversed; state before == after:
catalog `cat_01KXHFBJPFPCQ57W8GY20TWBG8` 7→7 treatments; Casey preferredPharmacies `[]`→`[]`;
Victor Hughes (rx=0, chosen as the test target) `[]`→`[]`; Peter's pre-existing CVS untouched;
both orders still `ROUTING`/no pharmacy — the demo's pending-selection state is intact.

## Decisions
Capability matrix (established by introspecting the live API — docs pages and SDL both lag it):

| Brief wanted | Reality | Result |
|---|---|---|
| `prescription(id:)` + orders | ✅ query; ❌ no `orders` field | orders via `fills { order }`, deduped |
| org-wide Rx/order lists | ✅ org-scoped for M2M | **D's patient-id fan-out dropped as unnecessary** |
| set order *or* preferred pharmacy | ✅ both (`routeOrder`, `updatePatient`) | **picker built** — preferred, not routeOrder |
| catalog add/remove | ✅ M2M-authorised despite no `*:catalog` scope | **add/remove built** |
| pharmacy search by zip | ❌ `LatLongSearch` = lat/long/radius; no geocoder | geolocation + mail-order instead |
| `medicationConcepts(name:)` | ❌ returns `null` for every term | `medications(filter:{drug:{name}})` |

- **Preferred pharmacy, not `routeOrder`** (brief permits either): routing is irreversible and would consume
  the pending-selection state Done-when #2 requires displaying. Setting preferred does not auto-route
  (Peter: preferred CVS, order still ROUTING).
- **Zip search impossible → browser geolocation** for pick-up, mail-order (location-free) as fallback.
  A zip→lat/long table would be fabricated data.
- **Role scoping is ours** (`lib/photon-scope.ts`), keyed on `clients`: admin→all, practitioner→caseload,
  client→self. By-id endpoint gates the *response* — whose row it is is unknowable until read.
- **Expired/Cancelled → muted** per brief; **changes shipped behaviour** — rx-tab had Cancelled as `danger`.
  `DRAFT` added to `PhotonRxState`. Catalog id resolved server-side, never from the request body.

## Open items
- `routeOrder` unwired by choice (above) — wiring it is small if in-app routing beats Photon's SMS flow.
- Lists bound at 200 rows across pages (footnote when hit); real org scale needs full cursor paging.
- Portal picker's pick-up mode is unusable without location permission; no non-geolocation path exists.
- **No Linear tickets filed** — nothing here is blocked or handed off.
- `docs/TASK-PHOTON-PHASE2.md` left unstaged (not my file).

## Gotchas
- **`first` must be ≤ 25** — `first: 200` → *"Invalid page size 200"*. All lists page via `after:`.
- **`Medication.controlled` is `Boolean!` but returns null**; one null fails the WHOLE query. Never select
  it. Any under-populated non-null scalar is the same trap.
- **One order batches fills across prescriptions.** Both of Peter's Rx point at ONE order (2 fills):
  Done-when #1's "Peter's Tylenol shows its two orders" is wrong — he has one; the org has two.
- `pharmacies(name:)` alone fails PICK_UP ("Missing location…"); MAIL_ORDER is the only location-free search.
- `Number(null) === 0` and is finite — a missing `lat` reads as a valid `0,0`; check presence before `isFinite`.
  `TreatmentCodes` = `rxcui`/`productNDC`/`packageNDC`/`SKU`/`HCPCS` — no plain `ndc`.
- Brief located the portal at `app/(portal)/…`; it is `app/portal/`. Third brief path/fact slip after report 1's two.

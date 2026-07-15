# 2026-07-15 — Patient portal home becomes the patient's own record

## Shipped
`22343ee` — 9 files. Portal home = the client record in the provider's own shell.
- New `app/portal/page.tsx` — `ClientHeader` + `ClientTabs`, tabs Overview · Personal · Rx · Insurance ·
  Records · Billing · Files.
- `app/portal/page.tsx` → `app/portal/dashboard/page.tsx` (git mv; old home UI verbatim, renamed export).
- `readOnly` prop added to `app/(app)/clients/[id]/{client-header,overview-tab,personal-tab,insurance-tab,
  files-tab}.tsx` — defaults false, so the provider record is byte-for-byte unchanged in behaviour.
- `components/shell/{app-shell,topbar}.tsx` — Home→`id-card`, Dashboard appended at nav foot, `/portal`
  TopBar now "Home" (was "Welcome back, X"; `routeTitle` no longer takes `user`).
- Verified as casey: shell renders; `Create prescription`, `Sync to Photon`, `New policy`, `Mark verified`,
  `Delete policy`, `Start a SOAP`, `AI Scribe`, `Change status`, `Save`, `href="/clients"`, `>Draft<` all
  ABSENT. As brendan: all still PRESENT on `/clients/[id]`. `tsc` clean.

## DB changes
**None.** No migration, no schema change, no rows written.

## Decisions
- **Extended the provider components with `readOnly`, did not duplicate them** — the one rule that outranks
  the others. Five components gained a flag instead of five near-copies drifting apart.
- **Rx tab renders the portal `MedicationsList`, NOT `RxTab`.** RxTab carries "Create prescription" (opens
  the provider Photon login) and "Sync to Photon".
- **Records tab renders the portal `RecordsList` (signed notes only), NOT the Documentation tab.** That tab
  renders drafts and can create/delete notes. `/portal/records` already filtered to `status: "signed"`;
  moving Documentation in verbatim would have silently reversed that call. Drafts are a clinician's
  thinking, not a record the patient is owed.
- Billing renders the portal `InvoicesList` (drafts already excluded, Stripe pay flow intact).
- **PersonalTab passed only the client's OWN practitioner**, not `listPractitioners()` — the disabled Select
  needs the matching option to render its label, and the patient has no reason to browse the roster.
- **Medications/Records/Invoices deliberately live twice** (nav item + record tab) — per Brendan: the record
  is the whole picture, the nav item is the direct route to one part.
- Home icon = `id-card`: `grid` went to Dashboard and `person-circle` would have collided with Profile.

## Open items
- **The pharmacy picker cannot be completed by a patient** — see Gotchas. This is the one flow that is
  genuinely broken; Brendan is taking it in a new session. No Linear ticket filed.
- **PersonalTab is a wall of disabled inputs.** Honest (same form, greyed, "Message your care team" where
  Save was) but grim. `FieldDisplay` — already used on Overview's contact card — would read better. Left as
  the true mirror so Brendan can judge it.
- Dashboard stat tiles still deep-link to `/portal/invoices` etc. Correct while both routes exist; would
  need `?tab=` repointing if the nav ever collapses into the record.
- `docs/TASK-PHOTON-PHASE2.md` still unstaged (Brendan's file). Nothing pushed; branch ahead 11, of which
  7 belong to the concurrent session.

## Gotchas
- **`pharmacies(name:)` is CASE-SENSITIVE and matches Photon's stored casing exactly.** Measured, same
  location/radius: `CVS`→5, `cvs`→0, `Cvs`→0, `Walgreens`→5, `walgreens`→0. Radius is a red herring —
  1/5/10/25/50 miles all return the same rows. **No single client-side transform fixes it**: Photon stores
  real-world casing, so upper-casing breaks Walgreens and title-casing breaks CVS. Location-only search
  (no `name`) works fine and returns real nearby pharmacies — so the likely answer is to browse nearby
  pharmacies and filter client-side over what's loaded, rather than pass `name` to the server at all.
  Bounded by `first ≤ 25`, so a wide radius needs `after:` paging.
- The picker's zero-results and denied-location states look alike from outside: "No pharmacies found" means
  geolocation SUCCEEDED and Photon returned nothing; "Location needed" is the denial branch.
- `readOnly` defaults to false on all five shared components — any new caller gets the provider behaviour,
  which is the safe default for staff pages and the WRONG default for anything patient-facing. Pass it.

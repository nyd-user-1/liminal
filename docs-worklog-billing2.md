# Worklog — UI standardization + billing v2 + forms + schedules (2026-07-10)

Live handoff doc. A fresh session picking this up: read this file top to bottom, check the
checkboxes below against `git log billing-feature-branch`, continue from the first unchecked item.
Branch: `billing-feature-branch` (repo `~/Code/liminal`, shared tree — stage+commit atomically,
never `git add -A`, leave other sessions' dirty files alone: `components/providers/qualifications-card.tsx`,
`lib/mock/services.ts`, `lib/repos/provider-profiles.ts`, `.impeccable/`, `sql/011_jason_provider.sql`).
No builds (dev server :3010 running), no browser checks — `npx tsc --noEmit` only
(4 pre-existing stale `.next/types` validator errors are NOT ours). Delete this file in the final commit.

## CORRECTIONS from Brendan (came in after the original asks — these override)
1. Tab restyle (teal fill/white text) — REVERTED, back to underline style. Done (`ad13cf0`).
2. TopBar button group (bell/profile/chat) — REVERTED to original bell + UserChip; actions stay
   in the right cluster but ALL TopBar action buttons are now `size="sm"`. Done (`0e2236a`).
3. Billing KPI strip must NOT sit above the split, and the split must be ONE container (not two
   separate cards). KPIs now live on a dedicated "Overview" tab in billing. Done (`47d17a8`).

## The asks (Brendan, 2026-07-10 ~3pm)

### A. Global UI standardization
- [x] **Tabs primitive** — teal-fill restyle applied then superseded by correction #1 (Brendan
  reverted it; underline style is the final answer here, do not redo).
- [x] **TopBar** — 3-button group (bell/profile-icon/chat) built then superseded by correction #2
  (Brendan reverted to bell + UserChip; final state is `0e2236a`, do not redo the 3-button group).
- [x] "+ New"-style primary actions confirmed routed through `<TopBarActions>` on every page
  (library, calendar, clients, settings/availability, settings/locations, settings/services,
  portal/appointments, portal/messages; billing/inbox already did) — all sized `sm` in `0e2236a`.

### B. Billing restructure (`/billing`)
- [x] KPI strip superseded by correction #3: lives on its own "Overview" tab, not a full-width
  container above everything (Brendan: KPIs must not sit above the split). Mobile mini-stat strip
  removed. Done `6fccf05` + `47d17a8`.
- [x] Open/Settled/Payers (+Overview) tabs at page level, below nothing but the H1 — `6fccf05`.
- [x] SearchInput at page level below tabs — `6fccf05`.
- [x] Left list pane agenda-style rows + pinned count — `6fccf05`.
- [x] Invoice pane: always-visible back arrow → `/billing`, mobile-only back TextLink removed,
  "No Stripe key" Banner removed, action buttons moved to top of scroll body, extra scrollbar
  padding — `6fccf05`.
- [x] Overview "Needs attention" as a real Table (`components/billing/attention-table.tsx`),
  Payments list in invoice-pane also a Table — `6fccf05`.
- [x] Split container unified into ONE bordered/shadowed container (correction #3) — `47d17a8`.

### C. Inbox (`components/messaging/inbox-shell.tsx`)
- [x] Page-level tabs + search above container — `670eb6f`.
- [x] Drafts tab: compose-modal drafts persisted in localStorage (`liminal:inbox-drafts`),
  reopen-on-click, delete, save-on-close, clear-on-send — `670eb6f`.

### D. Library / forms
- [x] Form detail breadcrumb toggle-back — already done in chunk A (`templates-client.tsx`
  renders it under Tabs+Toolbar, before the form builder). `/library/forms/[id]` is a
  separate, unreferenced legacy route (only linked from itself + design-system catalog) —
  left alone, out of scope.
- [x] Library "+ New" button — already in TopBarActions from chunk A, confirmed.
- [x] Seeded 6 real forms (`f253c7e`): GAD-7 Anxiety Screen, Consent to Treatment & Privacy,
  Telehealth Consent, Release of Information, Financial Policy & Card-on-File Authorization,
  Medication History. Applied to live Neon via `sql/012_seed_forms.sql` (psql, idempotent),
  mirrored in `lib/mock/forms.ts`. Forms category no longer pads to 12 with lorem cards.
  Verified in a real browser (Playwright against :3010) — 8 real cards render, no lorem.
  NOTE: two pre-existing stray DB rows ("Untitled form" draft, "Test Form") now show as real
  cards since padding is gone — not created by this session, left alone, flagging for Brendan
  to delete or keep.
- [ ] **ADHD ASRS-v1.1 assessment LAST, only if bandwidth remains** — source:
  https://add.org/wp-content/uploads/2015/03/adhd-questionnaire-ASRS111.pdf
  (18 items, Part A 6 items screener, 5-point frequency scale Never→Very Often).

### E. Schedules + headshots (Shelley Padgett, Jason Hilario)
- [ ] Brendan added headshots for both (find them — check `uploads/`, `public/`; another session
  created `sql/011_jason_provider.sql`, read it for the provider row shape, do NOT modify it).
- [ ] Seed appointments in live Neon: both fully booked TODAY, ~75% booked next week and the
  week after; sprinkle appointments for other practitioners through the rest of the month so it
  isn't only them. Respect the appointments schema (sql/001_schema.sql) + existing clients.
- [ ] Wire headshots as calendar/app avatars (Avatar primitive may need an image `src` prop —
  that's a primitive change, flag it) and make their profile pages feed the public provider
  profiles (`lib/repos/provider-profiles.ts` is ANOTHER SESSION'S dirty file — coordinate:
  read it, avoid editing if possible, or make minimal additive changes).

## Done so far (check git log to confirm)
- [x] Everything in the previous commit `4cf6dc7` (billing split view, pay sheet, emails,
  SidePanel mobileSheet, LIMINAL_EMAIL_FROM=billing@nysgpt.com in .env.local).
- [x] Chunk A (b322805 + ad13cf0 revert): library New→TopBar, breadcrumb toggle-back under
  library search (Breadcrumb gained onClick items), tab restyle applied then reverted.
- [x] Chunk B billing restructure (6fccf05 + 47d17a8): page-level tabs incl. Overview (KPIs),
  search toolbar, single split container, agenda-style rows + pinned count, invoice pane back
  arrow, Stripe banner removed, actions in body, payments + needs-attention as Tables.
- [x] Correction #2 TopBar (0e2236a): bell + UserChip revert, size=sm across all TopBar actions.
- [x] Chunk C inbox (670eb6f): page-level Open/Closed/Drafts tabs + search, localStorage drafts
  (save on close, reopen, delete, clear on send).
- Picked up by a fresh session (usage-window handoff) at `670eb6f` — everything above is
  committed and verified clean (`npx tsc --noEmit`, only the 4 pre-existing stale
  `.next/types` errors, not ours).
- [x] Chunk D forms (`f253c7e`): 6 forms seeded live + mirrored in mocks, lorem padding
  dropped from Forms category, breadcrumb/+New confirmed already-done from chunk A.
- NEXT: schedules/headshots (E), then ADHD (last, only if bandwidth remains).

## Order of attack
1. This doc. 2. ~~Tabs + TopBar (commit).~~ 3. ~~Billing restructure (commit).~~
4. ~~Inbox (commit).~~ 5. ~~Library breadcrumbs + New button + 6 forms seed (commit).~~
6. Schedules/headshots (commit). 7. ADHD assessment (commit).
Update checkboxes + "Done so far" after each commit.

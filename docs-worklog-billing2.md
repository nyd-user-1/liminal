# Worklog — UI standardization + billing v2 + forms + schedules (2026-07-10)

Live handoff doc. A fresh session picking this up: read this file top to bottom, check the
checkboxes below against `git log billing-feature-branch`, continue from the first unchecked item.
Branch: `billing-feature-branch` (repo `~/Code/liminal`, shared tree — stage+commit atomically,
never `git add -A`, leave other sessions' dirty files alone: `components/providers/qualifications-card.tsx`,
`lib/mock/services.ts`, `lib/repos/provider-profiles.ts`, `.impeccable/`, `sql/011_jason_provider.sql`).
No builds (dev server :3010 running), no browser checks — `npx tsc --noEmit` only
(4 pre-existing stale `.next/types` validator errors are NOT ours). Delete this file in the final commit.

## The asks (Brendan, 2026-07-10 ~3pm)

### A. Global UI standardization
- [ ] **Tabs primitive** (`components/ui/tabs.tsx`): selected tab = teal (`bg-primary`) with white
  text, rounded top corners only (like the ghost hover wash but solid) — count badge inside an
  active tab needs `bg-white/20 text-white`. Hover behavior unchanged.
- [ ] **TopBar** (`components/shell/topbar.tsx`): move the `TOPBAR_ACTIONS_ID` slot to sit right
  AFTER the page title (left cluster). Right cluster becomes a standardized 3-button group:
  bell (exists), profile icon (`person-circle` IconButton wrapping the existing DropdownMenu
  with name/email/sign-out — UserChip is REMOVED), chat icon (`message` IconButton →
  `/inbox` for practitioners, `/portal/messages` for portal variant). Applies to both variants.
- [ ] Any page rendering its own "+ New"-style primary action in content (library page does —
  see Image: "+ New" next to search) moves it into `<TopBarActions>` so every page's action
  appears after the H1. Billing/inbox already use TopBarActions.

### B. Billing restructure (`/billing`)
- [ ] KPI strip (4 StatCards from `invoiceStats`) moves OUT of the overview pane into its own
  full-width container ABOVE everything, rendered by BillingShell (layout already loads stats).
  Remove the mobile mini-stat strip from the list pane.
- [ ] Open/Settled/Payers tabs move OUT of the split container → page-level Tabs (below KPI strip).
- [ ] SearchInput moves OUT of the container → page level below tabs (like clients/directory pages).
- [ ] Left list pane styled like the calendar agenda panel (READ
  `components/calendar/*` or wherever the agenda pane lives — match its header/row/card look).
- [ ] Invoice pane (`components/billing/invoice-pane.tsx`):
  - Back arrow (always visible, not just mobile): IconButton arrow-left at header left →
    `router.push("/billing")` (fixes "can't get back to overview"). Remove the mobile-only
    back TextLink row from `app/(app)/billing/[id]/page.tsx`.
  - REMOVE the "No Stripe key" info Banner entirely.
  - MOVE the action buttons (Send/Record/Collect + kebab) from the header into the banner's old
    spot: top of the scroll body, above the document card.
  - A bit more right padding between cards and the scrollbar in scroll containers.
- [ ] Overview page (`app/(app)/billing/page.tsx`): now just "Needs attention" as a real `Table`
  (client wrapper for row onClick → new tiny `components/billing/attention-table.tsx`).
  Rule of thumb from Brendan: content cards >1000px wide shouldn't be cards → use tables.
  Also convert the Payments list in invoice-pane to a Table.

### C. Inbox (`components/messaging/inbox-shell.tsx`)
- [ ] Same treatment: tabs (page-level, out of container) + search above container.
- [ ] Add **Drafts** tab: compose-modal drafts persisted in localStorage
  (`liminal:inbox-drafts` = [{id, clientId, subject, body, savedAt}]). Closing compose with
  content saves a draft; Drafts tab lists them (client name via clients prop) with reopen-on-click
  (prefill compose) + delete; sending clears the draft.

### D. Library / forms
- [ ] Form detail (`app/(app)/library/forms/[id]` / library page): breadcrumbs move to UNDER the
  search bar, before the cards (lets user toggle back). Read the library page structure first.
- [ ] Library "+ New" button → TopBarActions (see A).
- [ ] Seed **6 real, usable forms** (live Neon DB — `DATABASE_URL` in .env.local; repos in
  `lib/repos/forms.ts`, schema in `sql/`): suggested GAD-7, Consent to Treatment & Privacy,
  Telehealth Consent, Release of Information, Financial Policy/Card-on-File, Medication
  History. New Client Intake + PHQ-9 already exist. DELETE the lorem "Forms N · Placeholder"
  cards in the Forms category only. Mirror in mocks if convention requires.
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

## Order of attack
1. This doc. 2. Tabs + TopBar (commit). 3. Billing restructure (commit). 4. Inbox (commit).
5. Library breadcrumbs + New button + 6 forms seed (commit). 6. Schedules/headshots (commit).
7. ADHD assessment (commit). Update checkboxes + "Done so far" after each commit.

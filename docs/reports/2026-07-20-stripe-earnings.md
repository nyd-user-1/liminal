# Stripe marketplace — provider Earnings page (tranche 2, item 4)

ui-agent (EARNINGS seam), 2026-07-20. Brief: `docs/TASK-STRIPE-MARKETPLACE.md`
(tranche-2 item 4) + the lead's kickoff. Companion: T3 report
`docs/reports/2026-07-20-stripe-t3.md`. One commit, local. **Not pushed.**

## Outcome

New practitioner-only route **`/earnings`** — the money view over the Stripe
connected account. Built, type-checked, and verified headless in its gated /
empty state and its practitioner-only gate. The two demo screenshots the founder
asked for (Overview + the Transactions fee-split) are **pending the T6 drive**,
which is hard-blocked on a founder Dashboard action (Connect not yet signed up on
the sandbox) — see "Pending" below.

## Commit

| | |
|---|---|
| `e33b29a` | The Earnings page — Overview / Transactions / Payouts, gated on `charges_enabled`; route-title + sidebar nav |

## What shipped

Three embedded surfaces under one pinned notification banner, chosen via a
`SegmentedControl` (the T3 pattern):

- **Overview** — `ConnectBalances` + a muted next-payout framing line.

- **Transactions** — `ConnectPayments` (the list; the built-in per-charge detail
  is powered by `payment_details` being enabled in the AccountSession). A
  `?payment=<id>` deep-link opens `ConnectPaymentDetails` in a kit `SidePanel`
  flyover — the one place the **application-fee split** is shown, and the target
  of a future "view this payment" link in a payout email. This is also the
  deterministic path for the demo screenshot (no clicking into a cross-origin
  Stripe iframe).

- **Payouts** — `ConnectPayouts` + `ConnectPayoutsList`.

- **Notification banner** pinned across all three views, height-clipped to zero
  until Stripe reports a notice (kept mounted so the iframe still loads and fires
  `onNotificationsChange` — height-clip rather than `display:none` so a hidden
  frame can't fail to report).

- **Express Dashboard** demoted to a quiet `TextLink` (variant `underline`),
  calling `POST /api/connect/login-link` → `{ url }` — a muted fallback, not a
  primary action.

- **`disputes_list` omitted by design** — destination charges put disputes on the
  PLATFORM, so a connected account's dispute list is empty and would read as
  broken.

- **Gating** — nothing money-related mounts unless the account is `active`
  (`charges_enabled` true). Any earlier stage (no account, mid-onboarding, or
  verification pending) collapses to one `EmptyState` — "Set up payments first" —
  pointing at `/settings/payments`. The brief's rule: never mount money
  components for an account that can't take charges.

### Files

New, all under `app/(app)/earnings/`:

- `page.tsx` — thin server shell; passes the publishable key, wraps the client in
  `<Suspense>` (it reads `?view=` / `?payment=` search params). Auth is inherited
  from `app/(app)/layout.tsx` (no session → `/sign-in`, client → `/portal`), so
  the route is practitioner-only by construction.

- `earnings-client.tsx` — the state machine + the three views.

**Reused, not edited** (as the brief required — "import, don't edit"): the
settings seam's `connect-embed.tsx` (the `ConnectComponentsProvider` runtime +
kit theming) and `connect-api.ts` (the five-call route contract). The Earnings
client imports both by relative path; it never touches `lib/repos/stripe-connect.ts`
or `app/api/**`.

**Kit primitives only** — SegmentedControl, Card, EmptyState, Banner, Button,
Spinner, TextLink, SidePanel, plus the reused ConnectEmbed. **No new primitives,
no feature-component duplication.** The one composition worth naming is the
`payment_details` flyover: `ConnectPaymentDetails` rendered inside a `SidePanel`.
The panel portals to `document.body`, but React context propagates through
portals, so the Stripe Connect context still reaches it — provided the panel is
rendered within the `ConnectEmbed` subtree, which it is.

Canonical layout respected: no page-level H1 — the route H1 ("Earnings") is
derived from the route-title map and rendered by ContentHeader; the page renders
none of its own.

## Nav insertions (the only edits to existing files)

The brief authorized exactly two: "topbar.tsx ROUTE_TITLES + sidebar." Both have
since moved from where the brief names them — flagging so nobody re-litigates:

- `components/shell/route-title.ts` — the `ROUTE_TITLES` map (moved out of
  `topbar.tsx` into its own module). Added `["/earnings", "credit-card", "Earnings"]`.

- `components/shell/app-shell.tsx` — `WORKSPACE_NAV`, the **practitioner-only**
  section list (the generic `Sidebar` in `sidebar.tsx` just renders whatever
  sections it's handed; the workspace list lives here). Added Earnings to the
  **Practice** group, beside Billing.

`credit-card` (not `dollar`) for the icon: Billing already owns `dollar` and sits
directly above Earnings in the same group — two identical adjacent icons scan
poorly. `credit-card` also ties Earnings to the "Get paid" settings card, which
uses it.

**Deliberately NOT touched** (would be a third+ edit, out of the authorized two):
the TopBar `SWITCH_DESTINATIONS` list and the `⌘K` command-palette destinations.
Earnings is reachable via the sidebar + direct URL + route-title today; adding it
to those two secondary lists is a trivial follow-up if wanted.

## Verification (evidence, not exit codes)

- `tsc --noEmit` — clean at the commit.

- **Gated / empty state — VERIFIED headless.** Real cookie login as
  `brendan@liminal.demo` against the running dev server. `/earnings` → HTTP 200;
  TopBar H1 "Earnings"; sidebar shows Earnings active in the Practice section
  between Billing and Catalog; the "Set up payments first" EmptyState + CTA
  render; **zero console errors, zero page errors**. The current connected
  account is not yet `active`, which is exactly why this state shows.
  Screenshot: `docs/reports/assets/2026-07-20-stripe-earnings/earnings-gated.png`.

- **Practitioner-only gate — VERIFIED headless.** Login as `casey@liminal.demo`
  (role `client`) → `GET /earnings` redirects to `/portal`. Clients never see the
  page.

- **Unauthenticated gate — VERIFIED.** `GET /earnings` with no session → 307 to
  `/sign-in`.

## Pending the T6 drive (what remains, and what it needs)

The **active money views** (balances, the payments list, payouts) and the
**Transactions fee-split flyover** cannot be driven tonight: they require an
**active connected account** (`charges_enabled` true) **and one paid charge** —
both produced by the T6 e2e drive, which is hard-blocked at step 1 on a founder
Dashboard action (Connect isn't signed up on the sandbox). No charge id exists
yet. These states are type-checked and contract-matched but **not visually
verified**.

When the drive completes, the two founder screenshots are a ~5-minute follow-up
(the lead will resume me with the charge context):

- **Overview** — `/earnings`, balances rendered.

- **Transactions fee-split** — `/earnings?view=transactions&payment=<charge_id>`,
  the `payment_details` flyover open showing the **$150.00 charge with its $15.00
  application-fee split**.

The demo driver is already written and staged in the scratchpad
(`earnings-demo.mjs`, takes the charge id as its one argument); the deep-link
route (`?view=…&payment=…`) is built and type-checked, so nothing new needs
building — only the sandbox needs to come alive.

## Flags for the lead

1. **Brief's nav filenames are stale.** `ROUTE_TITLES` now lives in
   `components/shell/route-title.ts` (not `topbar.tsx`), and the practitioner
   sidebar list is `WORKSPACE_NAV` in `components/shell/app-shell.tsx` (not
   `sidebar.tsx`). I edited the real homes; both are within the two authorized
   nav insertions. Worth correcting in the brief for the next builder.

2. **Earnings not in the ⌘K palette or the TopBar section-switcher.** Left out on
   purpose to stay within the two authorized edits. Trivial to add; your call.

3. **Whether the connected-account payments list actually shows a destination
   charge is a data/Stripe-config question, not a UI one.** For a plain
   destination charge (no `on_behalf_of`), the connected account may see a
   Transfer rather than a Payment, in which case `ConnectPayments` /
   `ConnectPaymentDetails` on the connected-account session could come back empty.
   The account-session enables `payments` + `payment_details` for exactly this
   view (commit d80fc70) and the brief asserts the split renders — the T6 drive is
   the thing that confirms it. If the drive shows the split does NOT render on the
   connected account, that's a charge-creation concern for the API seam; my
   surface will render whatever the session exposes, and I'll report honestly what
   appears.

4. **Shared runtime untouched, as instructed.** `connect-embed.tsx` and
   `connect-api.ts` needed no change for this page — the existing contract and
   theming covered it. Nothing to flag there.

## Not pushed

One local commit (`e33b29a`) plus this report. Push is deploy; the founder gates
it.

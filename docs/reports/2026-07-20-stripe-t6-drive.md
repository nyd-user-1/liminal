# Stripe Connect T6 — end-to-end marketplace drive

Executing `scripts/qa/stripe-e2e.md` against the NYSgpt sandbox (test mode) on
`localhost:3010`. qa-agent, 2026-07-20.

---

## PART 1 — pre-Connect verification (interim; drive pending founder Dashboard action)

**Committed while blocked, on the lead's ruling, for durability** — the
verification below currently exists only in the drive session. PART 2 (the
actual money loop) extends this same file once the founder enables Connect.

### Outcome in one line

The full T6 loop is **blocked at step 1**: no connected account can be created,
because **Connect is not signed up on the sandbox platform account**. Everything
our own code owns up to that boundary is verified working. The one blocker is a
~1-minute founder Dashboard action, escalated by the lead.

### The blocker — measured, not assumed (could NOT reproduce the "Connect enabled" claim)

The T6 environment note stated "Connect is enabled on the sandbox." That is the
one claim I could not reproduce. `stripe.accounts.create(...)` fails from Stripe,
three ways, all identical:

```
POST /api/connect/account  (as brendan, cookie login)
  → HTTP 500  {"error":"Could not create the payout account."}   (our route degrades cleanly)
  underlying Stripe error (dev.log):
    StripeInvalidRequestError 400
    "You can only create new accounts if you've signed up for Connect,
     which you can do at https://dashboard.stripe.com/connect."
    request: req_xdmWO2t6wEbJid   acct_1T1DhaFZHX4S0kX2

Direct Stripe API, bypassing our route entirely:
  accounts.create({controller: <the founder-locked triple>})  → 400  same message
  accounts.create({type:"express"})                            → 400  same message
  accounts.create({type:"standard"})                           → 400  same message
```

So it is **platform-level, not our controller config and not our code** — even
the simplest bare create is rejected. The platform account is otherwise healthy:

```
stripe.accounts.retrieve()  → acct_1T1DhaFZHX4S0kX2  country=US  charges_enabled=true
stripe.accounts.list({limit:1})  → succeeds, returns []   (NOTE: list works even
     when create is blocked, so an empty list is NOT proof Connect is enabled —
     only a successful create is. This is almost certainly the false positive
     behind the original "confirmed via API" note.)
```

**Founder action (~1 min):** Stripe Dashboard → test mode → Connect → sign up /
enable the platform, on `acct_1T1DhaFZHX4S0kX2`. This is the only thing blocking
the whole loop; keys, CLI, and `stripe listen` are all confirmed present.

### Verified GREEN — everything our code owns short of a connected account

All read-only or degrade-path; no live-DB mutation. Evidence is the actual
response, not an exit code.

**Preflight** (`node --env-file=.env.local scripts/qa/preflight.mjs`): keys
present (`sk_test_…`, `pk_test_…`, `whsec_…`), Stripe CLI `1.43.8`, sql/061
tables present, INV-2026-9003 `sent` $150.00, dev server responding. "Clear to
drive." (The two advisories — CLI login config absent, no connected account yet
— are expected: `stripe listen` is already running detached, and step 1 mints
the account.)

**Auth guards — 401 with no cookie** on every write route:

```
POST /api/connect/account          401
POST /api/connect/account-session  401
POST /api/connect/account-link     401
POST /api/connect/login-link       401
POST /api/checkout/session         401
```

**Graceful degradation — logged-in practitioner, no account yet:**

```
GET  /api/connect/status          200  {"account":null}              (correct "none" state)
POST /api/connect/account-session 404  "No payout account yet. Create one first."
POST /api/connect/account-link    404  "No payout account yet. Create one first."
POST /api/connect/login-link      404  "No payout account yet."
POST /api/connect/account         500  "Could not create the payout account."  (Stripe 400 → clean 500, no partial row written)
```

**Webhook + marketplace gate:**

```
POST /api/stripe/webhook  (unsigned)                → 400  "Missing signature."
POST /api/checkout/session (as Casey, invoice 9003) → 409  "This practitioner hasn't set up payouts yet."
```

The 409 is the marketplace path's `charges_enabled` gate doing its job (it is
read-only — no Checkout Session was created, invoice untouched). This is exactly
the branch the portal Pay button falls back from. **I deliberately did not click
the portal Pay button** — it would fall through to the pre-marketplace mock path
and settle the live invoice, destroying the payable state PART 2 needs.

**Login** works for both roles: `brendan@liminal.demo` → `role=admin` (accepted
by `requireRole("practitioner")` per `lib/auth.ts`), `casey@liminal.demo` →
`role=client`.

**Screenshots (2 of the required set are reachable now):**

- `scratchpad/shot-getpaid-empty.png` — provider Settings › Get paid, the **none**
  state: "Set up payments" empty state, teal CTA, PHI-free copy. Single H1
  "Settings" lives in the TopBar; the page renders none — **canonical layout
  contract holds.**
- `scratchpad/shot-invoice-payable.png` — Casey's portal, INV-2026-9003 sheet in
  its **payable "before"** state: line item "Therapy session" (generic, PHI-safe),
  Balance due $150.00, "Pay $150.00", and the copy "You'll be redirected to
  Stripe's secure checkout" (confirms the portal detects Stripe is live, i.e.
  `hasStripe()` true). No horizontal scroll on the panel.

(The remaining two — active Get-paid card, paid invoice — need a live account and
land in PART 2.)

**Baseline DB — clean, and unchanged by every probe above:**

```
stripe_events: 0   stripe_payment_splits: 0   stripe_connect_accounts: 0
INV-2026-9003: status=sent  total=$150.00  payments=0  splits=0
```

### Claims from the shipping reports — confirmed vs. could-not-reproduce

- **CONFIRMED** — the prep report's finding #5 ("the webhook does not yet record
  splits") is **fixed** in the shipped code: `app/api/stripe/webhook/route.ts`
  now claims the event, records the payment, records the split via
  `recordPaymentSplit`, and sends both receipts. Both event scopes are handled
  (`checkout.session.completed` platform, `account.updated` connected).
- **CONFIRMED** — keys present, CLI installed, `stripe listen` running on both
  scopes, our route/webhook code correct and degrading cleanly.
- **COULD NOT REPRODUCE** — "Connect is enabled on the sandbox." Connect is not
  signed up; see the blocker above.

### Flags for the lead (no Linear filed — lead-only this tranche; no code defect to file)

1. **T5 Resend-id evidence gap (code observation, lead is logging the fix).**
   `lib/email.ts` `sendEmail()` awaits `resend.emails.send(...)` and discards the
   response, so the Resend message id is never captured or logged. "Capture
   Resend message ids" is therefore not satisfiable from our side — in PART 2 I
   will pull ids from the Resend API post-send. Separately worth watching in
   PART 2: recipients are demo addresses (`casey@`/`brendan@liminal.demo`); if
   the Resend sending domain isn't verified, sends to non-owner addresses may 403
   and be swallowed as `false`. (Lead ruled: do not edit `lib/email.ts` — shared
   file, out of my seam; logging the capture-the-id fix as a polish finding.)

2. **Environment-note accuracy.** The "Connect enabled, confirmed via API" note
   was a false positive from `accounts.list` (see the list-vs-create nuance
   above). Flagging so the check is create-based going forward.

### What I could not reach with my access

- Anything downstream of a created connected account: onboarding, the
  `account.updated` capability sync, `charges_enabled`, the destination charge,
  the split, `verify-split.mjs`, the two emails, `login-link {url}`, and the two
  remaining screenshots. All gated on Connect being enabled.
- **Code-read-only caveat:** the `account-link` HTTPS-return-URL guard (503 when
  origin is plain http) is shadowed by the no-account 404 short-circuit, so it
  cannot be exercised live until an account exists. Confirmed by reading
  `app/api/connect/account-link/route.ts` (checks `getConnectAccount` first);
  will exercise in PART 2 if reachable.

### Drive-doc amendments committed (local only, never pushed)

`scripts/qa/stripe-e2e.md`, four commits: (1) primary test card →
`4000 0000 0000 0077` (funds land in the available balance immediately; 4242 kept
as the pending variant); (2) explicit assertion that BOTH proof events are
recorded in `stripe_events` — `checkout.session.completed` (platform) AND
`account.updated` (connected), loop not proven if either is missing; (3)
`stripe_events` column-name fix (`id`/`stripe_account_id`/`received_at`); (4) the
measured Connect-blocker banner replacing the stale "all cleared" note.

### Cleanup status

Nothing to clean yet — the drive created no DB rows (baseline is still 0/0/0 and
the invoice is untouched). PART 2 cleanup will follow the brief: restore
INV-2026-9003, delete the `stripe_events` + `stripe_payment_splits` rows the
drive creates (counts before/after), and **keep** the `stripe_connect_accounts`
row and the Stripe sandbox account (deleting the row while the `acct_…` exists
creates drift; the onboarded account is reusable). Temp helpers
(`scripts/qa/_tmp-*.mjs`) are untracked and never staged; removed at drive
completion.

### PART 2 plan (unblocks the moment Connect is enabled)

account create → embedded/hosted onboarding with Stripe test data (SSN
`000-00-0000`, DOB `1901-01-01`, bank `000123456789`/`110000000`) → wait for
`account.updated` (connected scope) → `charges_enabled=true`, exercise
`GET /api/connect/status` → Casey pays INV-2026-9003 with `4000 0000 0000 0077` →
`checkout.session.completed` (platform scope) settles via webhook (portal shows
paid via the poll, not the redirect) → `verify-split.mjs` diffs Stripe's
PaymentIntent/charge/fee/transfer against `stripe_payment_splits` (expect gross
$150.00 / fee $15.00 / net $135.00 → `acct_…`) → **assert both events recorded in
`stripe_events`** → Resend ids for the two emails via the Resend API →
`POST /api/connect/login-link` → `{ url }` → screenshots (active Get-paid card,
paid invoice) → cleanup as above. The `pi_…`/`ch_…` ids go to the
earnings-surface agent for its demo deep-link.

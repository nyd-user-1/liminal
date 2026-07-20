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

> **Environment switched after PART 1 was written.** Everything above was
> measured against platform account `acct_1T1DhaFZHX4S0kX2`. The keys were
> re-saved ~03:08 and the environment of record became
> **`acct_1T1DhqFTCTbH09lM`** (NYSgpt sandbox) — a *different* Stripe
> environment, where Connect was then enabled. PART 1's findings stand as
> measured; the account id simply belongs to the prior environment. All of
> PART 2 runs against `acct_1T1DhqFTCTbH09lM`.

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

---

## PART 2 — Connect enabled; account created; drive halted by a capabilities defect + captcha-gated onboarding

Connect was enabled on `acct_1T1DhqFTCTbH09lM` and the drive resumed at ~03:09
local. Steps 1 and 2 of the drive ran; the loop stops short of `charges_enabled`.

### Step 1 — account creation: PASSED, controller triple verified

`POST /api/connect/account` (practitioner cookie) → **200**, `created: true`.

```
stripe_connect_accounts row:
  id                 42062cf9-ee92-43d2-b428-cf068012ae07
  user_id            00000000-0000-4000-8000-000000001001   (Brendan)
  stripe_account_id  acct_1TvBKiJvfwWFuhCf
  charges_enabled=false  payouts_enabled=false  details_submitted=false
```

Retrieved from Stripe — the founder-locked controller triple landed **exactly**:

```
controller.stripe_dashboard.type = express
controller.fees.payer            = application
controller.losses.payments       = application
controller.requirement_collection = stripe      (Stripe collects — the default, as intended)
controller.type                   = application
business_profile.mcc              = 8099
business_profile.product_description = "Outpatient behavioral health sessions billed through Liminal."
metadata = { liminalUserId: … }                 (internal id only — no PHI)
```

**Idempotency confirmed:** a second `POST /api/connect/account` returned
`created: false` with the same `acct_…` — no duplicate account minted. (A
duplicate is not cosmetic: it splits payout history and needs Stripe support to
unwind.)

### DEFECT — T2, HIGH: no capabilities requested, so destination charges can never work

`POST /api/connect/account` calls `stripe.accounts.create` **without a
`capabilities` parameter**, so the connected account holds none. A destination
charge REQUIRES the destination account to hold the **`transfers`** capability.
Ours will never acquire it, and its onboarding only ever collects bank + ToS —
so even a fully completed manual onboarding leaves the money loop dead.

Measured against a throwaway account with the identical controller triple but
`capabilities` requested (created and **deleted immediately**, `acct_1TvBf1FIWRJcO7JG`):

```
OURS (no capabilities param)
  capabilities  {}
  currently_due [external_account, tos_acceptance.date, tos_acceptance.ip]

THROWAWAY (capabilities requested)
  capabilities  { card_payments: "inactive", transfers: "inactive" }
  currently_due [business_type, external_account, representative.dob.day/month/year,
                 representative.email, representative.first_name, representative.last_name,
                 settings.payments.statement_descriptor, tos_acceptance.date, tos_acceptance.ip]
```

Current state of our account: `charges_enabled=false`, `payouts_enabled=false`,
`details_submitted=false`, `capabilities {}`, `disabled_reason
"requirements.past_due"`.

**Fix (worker A's seam — I have not touched app/lib code):** add
`capabilities: { transfers: { requested: true }, card_payments: { requested: true } }`
to the `accounts.create` call.

**Ordering matters:** this must be fixed *before* anyone hand-completes
onboarding, or the manual pass collects the wrong requirement set and has to be
redone.

### BLOCKER — Stripe onboarding is captcha/anti-automation protected; it needs a human

Onboarding cannot be completed headlessly, on either surface. This is Stripe
protecting its own flow by design, not a defect in our code:

- **Hosted Account Link** (`connect.stripe.com/setup/e/acct_…`): the first step
  offers "Use test phone number", which fills correctly
  (`phone_number = +10000000000`), but an **invisible hCaptcha challenge iframe
  intercepts pointer events** on the Submit control (an `<a role="button">`):
  `<iframe title="hCaptcha challenge" …> from <div>…</div> subtree intercepts
  pointer events`. After retries the page degrades to "Having trouble signing
  up? Contact Support".
- **Embedded `ConnectAccountOnboarding`** in our own app: renders correctly (3
  Stripe iframes, `embeddedComponent=stripe-connect-account-onboarding`, themed
  to our brand), but the "Add information" entry click does not advance — no new
  frame, no state change.

**I did not attempt to solve or bypass the captcha, and will not** —
circumventing anti-automation is out of bounds. **A human must complete
onboarding once** (~2 min in a real browser). Everything downstream of
`charges_enabled` is fully automatable and will be driven end to end.

### Webhook pipeline — PROVEN HEALTHY (real signed event, end to end)

A genuine Stripe-signed `account.updated` arrived through the forwarder and was
recorded green:

```
id           evt_1TvBZ8FTCTbH09lMIXZ7DW2w
type         account.updated
stripe_account_id  NULL          ← PLATFORM scope (this event is about the platform acct)
received_at  2026-07-20T07:24:42.584Z
processed_at 2026-07-20T07:24:42.774Z
error        NULL
```

So signature verification against the current `whsec`, the `claimStripeEvent`
idempotency path, the handler, and `completeStripeEvent` all work. `handleAccountUpdated`
correctly no-op'd for an account it has no row for (documented behavior).

This is **not** the connected-scope event the both-events assertion needs — that
one carries `stripe_account_id = acct_1TvBKiJvfwWFuhCf` and fires when a human
completes onboarding. **Both-events assertion remains UNPROVEN.**

### PART 1's code-read-only caveat — now CLOSED with live evidence

With an account in place, the previously-shadowed guard is reachable:

```
POST /api/connect/account-link  (http origin)  → 503
  "Hosted onboarding needs an HTTPS return URL. Set CONNECT_RETURN_BASE_URL to a tunnel or the deployed domain."
POST /api/connect/login-link    (pre-onboarding) → 500 "Could not create a dashboard link."
```

The `login-link` 500 is **expected** and matches the route's own documented
comment: Stripe rejects login links for accounts that haven't finished
onboarding; the UI only shows that button in the active state. It will be
re-tested for `{ url }` after onboarding.

### Screenshot added

- `scratchpad/shot-getpaid-onboarding.png` — provider Get-paid in the
  **onboarding** state: "Finish setting up payments" card, the "Open on Stripe
  instead" fallback, and the embedded Stripe component rendering "Add
  information to start accepting money". Two `429` console errors were observed
  from Stripe resource loads (rate limiting; benign, noted not diagnosed).

### Additional flag — secret hygiene

The `stripe listen` forwarder (pid 34143) is invoked with `--api-key sk_test_…`
on the command line, so the secret key is visible in `ps` output to any local
process. Test-mode key, so low severity, but the pattern shouldn't carry to
anything live — prefer `stripe login` / `STRIPE_API_KEY` in the environment.

### Infra note — a whsec false alarm worth recording

An initial check reported a `whsec` MISMATCH between the forwarder log and
`.env.local`. That was a stale artifact: `stripe-listen.log` is the *old*
pre-rebuild forwarder (`whsec_a2805172…`, process dead). The live forwarder
(pid 34143, both `--forward-to` and `--forward-connect-to`) logs to
`stripe-listen2.log` and its `whsec_0322fa681d…` **matches** `.env.local`.
Anyone re-checking this should read `stripe-listen2.log`.

### State at halt

```
stripe_events: 1 (the platform-scope account.updated above)
stripe_payment_splits: 0
stripe_connect_accounts: 1 (acct_1TvBKiJvfwWFuhCf — KEEP per the drift guardrail)
INV-2026-9003: status=sent  $150.00  payments=0     (untouched, still payable)
```

Nothing needs restoring yet: no payment was attempted, and the Pay button was
never clicked (clicking it would fall through to the pre-marketplace mock path
and destroy the payable state the drive needs).

### Still UNPROVEN — the entire money loop

`charges_enabled` · the connected-scope `account.updated` · the destination
charge · the $150/$15/$135 split · `verify-split.mjs` · the both-events
assertion · the two Resend emails · `login-link { url }` · the active-card and
paid-invoice screenshots · and the NYS-173 question (whether the connected
account sees the fee split or only the net). All are gated on: fix the
capabilities defect → a human completes onboarding once → I drive the rest.

# Lead review — Stripe Connect marketplace, tranche 1 (2026-07-20 overnight)

Reviewed live as commits/reports landed (~01:12–02:00 ET). Brief:
`docs/TASK-STRIPE-MARKETPLACE.md`. All work local, **not pushed**.

## Verdict

**Tranche 1 accepted.** All six build tasks have code on main; every commit
reviewed; three of four reports in and accepted (D's report outstanding —
their code + drive doc landed and were reviewed directly). Seams held across
four concurrent terminals with one process incident (below), zero product
collisions. The environment is now fully unblocked: sandbox keys live,
two-scope webhook forwarder running, whsec captured, dev server restarted,
routes probing correctly (status→401, unsigned webhook→400).

## Per-worker

- **A (backend, T1+T2)** — sql/061 (3 tables; XOR owner CHECK; idempotency
  ledger; splits keyed on PaymentIntent), repo module on-convention, 6 routes
  with auth + logEvent throughout, webhook EXTENDED not rewritten,
  charges_enabled as the only checkout gate, fee in one shared helper
  (floored — rounding favors the therapist). Report honest: "verified up to
  the Stripe boundary and no further."

- **B (Settings T3 + CSP)** — /settings/payments four-state surface, kit
  primitives only, no H1. CSP shipped REPORT-ONLY deliberately (enforcing
  would risk silently breaking Photon/Auth0/Blob) and framed as an open item.
  Only the no-account state truly driven; said so.

- **C (portal T4 + emails T5)** — stubs-first seam contract, Resend bodies on
  the existing shell, two render-caught defects self-fixed (UTC due_by,
  humanized dispute reasons). T4 re-points the existing pay surface: Connect
  checkout first, 409/503 fallback to the legacy path, paid state from the
  WEBHOOK (poll + "confirming"), not the redirect — fixed a pre-existing
  honesty bug. Live-DB drive cleaned up, audit row correctly left.

- **D (qa T6 prep)** — preflight (measured the 4 env blockers), seeded
  INV-2026-9003 (cleanup script provided; still seeded, wanted for T6),
  drive doc, verify-split.mjs (diffs Stripe's objects against our row — "our
  own row can't be its own evidence").

## Findings (open)

1. **`completeStripeEvent` sets `processed_at` even on error** — contradicts
   sql/061's worklist semantics AND A's report flag 4; the purpose-built
   partial index (`WHERE processed_at IS NULL`) misses failed events. Fix:
   on error, record `error`, leave `processed_at` NULL. Mock path: same, and
   it drops the error string. (A, one-liner each.)

2. **T6 drive doc uses card 4242** — advisor ruling (post-dispatch): switch
   to 4000 0000 0000 0077 (funds land AVAILABLE immediately → instant payout
   verification) and assert BOTH proof events arrive
   (checkout.session.completed platform-scope; account.updated
   connected-scope). (D's doc, small edit.)

3. **`POST /api/connect/login-link` doesn't exist** — T3 promises an Express
   Dashboard link; T2's route list omitted the route. B's button degrades to
   a toast. Founder fork: add the route (small) or drop the button.

## Rulings made (lead, delegated discretion)

- MCC **8099** over the brief's 8049 (8049 = podiatrists/chiropodists; 8099 =
  health practitioners NEC). Deviation documented at the constant. Accepted.
- **/settings/payments** canonical route; tab label "Get paid". Ratified
  (A's return URLs + C's CTAs + B's page converged).
- Client receipt **omits the platform fee** (therapist email states
  gross/fee/net). Ratified; revisit only if pricing makes fees client-facing.
- lib/email.ts +2 exports by C (out of named seam, two words, reuse-first).
  Ratified.
- **No fee % printed in the UI** until pricing (fork #1) is decided. Ratified.
- lib/email/ dir beside lib/email.ts — consolidation deferred to a polish
  pass. Banner spinner-vs-bell — ui-agent backlog, no unilateral prop adds.

## PHI note (founder attention)

A fixed a PRE-EXISTING leak: /api/stripe/checkout sent invoice line
descriptions (service names) to Stripe. D found it independently. Local was
always mock (no keys until tonight) — but **if the deployed Vercel env has a
real STRIPE_SECRET_KEY, historical checkouts may have sent service names to
Stripe**. Check `vercel env ls` + Stripe dashboard history once.

## Seam incident (process, resolved)

B staged their get-paid→payments route move (fixing a real 3-file 404
collision across seams); C's session committed the shared index without
pathspecs, sweeping B's staged files into C's report commit (27a57e1).
Content correct and stands; attribution wrong. **House-rule amendment for
all future kickoffs: check `git diff --cached --name-only` immediately
before every commit, or commit with explicit pathspecs.**

## Environment state (post-unblock, ~02:00)

- NYSgpt SANDBOX is the environment of record (not legacy test mode).
- `.env.local`: 3 Stripe vars (values quoted — fine for Next, strip quotes
  when consuming from shell). Backup at .env.local.bak-2026-07-20T05-55-17.
- `stripe listen` running detached (scratchpad log), forwarding BOTH scopes
  to localhost:3010/api/stripe/webhook.
- Dev server restarted with the env; unsigned webhook POST → 400 (secret
  loaded); /api/connect/status → 401.
- Connect enabled on the sandbox; 0 connected accounts (clean slate).
- INV-2026-9003 still seeded for the T6 drive.

## Tranche 2 proposal (AWAITING FOUNDER GO — nothing dispatched)

1. **T6 end-to-end drive** (qa-agent): scripts/qa/stripe-e2e.md with the two
   amendments (card 0077; assert both proof events). Deliverable: the split
   shown from Stripe's own objects (charge $X / fee 10% / transfer acct_…),
   Resend log ids, screenshots. Then `seed-test-invoice.mjs --cleanup`.
2. **Fix pass** (backend): finding 1 (worklist semantics) + finding 3 if the
   founder wants the login-link route.
3. **Bookkeeping** (lead): Linear records for the tranche, queue/memory
   updates, drive-doc amendment review.
4. Open forks unchanged from the brief (pricing model, Managed Risk,
   separate charges & transfers, TIN onboarding/1099, go-live checklist,
   direct-vs-aggregator cohort surface).

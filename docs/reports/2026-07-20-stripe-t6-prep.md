# Stripe marketplace T6 prep — qa-agent report (recovered)

> Lead note: D's session printed this report in-terminal and never wrote the
> file; the founder pasted it to the lead ~02:05, who persisted it here
> verbatim. Written BEFORE A's T2 (004d537) landed — see the lead
> reconciliation at the bottom. Commit: 5a0580c.

Committed 5a0580c, my seam is clean, nothing pushed.

Report — qa-agent, T6 prep

T6 cannot run tonight. Four founder-side blockers, all measured, none fixable
by me:

- No Stripe keys exist. .env.local has zero STRIPE_* entries. The brief
  inferred they existed because invoice checkout exists — but that route has
  been running on lib/stripe.ts's mock branch since it was written
  (getStripe() returns null → fake success redirect). It has never talked to
  Stripe.
- No publishable key, so T3's embedded Connect components can't initialise.
- No webhook secret, so /api/stripe/webhook 503s every event — and the
  webhook is the only authoritative settlement path.
- Stripe CLI isn't installed, so stripe listen never happened and I had no
  whsec to capture. scripts/qa/capture-whsec.mjs is written and tested; it's
  one command once the CLI lands.

Clearing all four is ~10 minutes — exact commands are at the top of the doc.

Delivered (scripts/qa/, committed, not pushed):

- stripe-e2e.md — the drive: test data table (SSN 000-00-0000, DOB
  1901-01-01, bank 000123456789/110000000, card 4242…, plus the failure
  variants), the step sequence, and the API calls that prove the split.
- preflight.mjs · seed-test-invoice.mjs · verify-split.mjs ·
  capture-whsec.mjs — all four run; guards and write paths tested (the whsec
  writer on a throwaway env file, not yours).

Test invoice seeded — needs cleanup, live DB. INV-2026-9003, $150.00, sent,
Casey Morgan, attached to the completed 2026-06-15 appointment so the charge
has a therapist to pay. Casey's other three invoices are all paid, so before
this the portal had nothing to click. Verified by cookie login, not assumed:
/portal/invoices returns 200 with the invoice, $150.00, and one Pay now
button. Removal: node --env-file=.env.local scripts/qa/seed-test-invoice.mjs
--cleanup.

Three flags for the lead:

1. PHI risk in the existing checkout route —
   app/api/stripe/checkout/route.ts:74-76 sends the practice name as the
   Stripe product and joins every invoice item description into
   product_data.description. Stripe signs no BAA and the guardrail says line
   items read "Therapy session". My seeded item is generic so the drive is
   clean, but the path forwards whatever an item says. Route owner's fix; I
   own scripts/qa/ only.
2. nextInvoiceNumber() is a footgun — it casts SUBSTRING(number FROM 10)::int
   over all INV-2026-% rows, so any seeded invoice with a non-numeric suffix
   breaks invoice creation app-wide. Documented; worth a guard.
3. The webhook records no splits yet — it handles only
   checkout.session.completed and calls neither claimStripeEvent nor
   recordPaymentSplit. Until T2 wires those, verify-split.mjs will correctly
   report a missing split row rather than pass.

One design note on verify-split.mjs: it diffs Stripe against
stripe_payment_splits rather than reading our row and calling it proof. That
row is written by the code under test, so it can't be its own evidence — a
green row with no matching Stripe transfer is the exact failure the diff
catches.

---

## Lead reconciliation (2026-07-20 ~02:10)

Report ACCEPTED. Timeline: D's session ended before A's T2 (004d537, 01:23)
was observable to it, so:

- Flag 1 (PHI in the old checkout route) — RESOLVED by A in 004d537, found
  independently by both workers (convergence noted in the lead review).
- Flag 3 (webhook wires no splits) — RESOLVED by A in 004d537
  (claimStripeEvent + recordPaymentSplit both wired; reviewed).
- Flag 2 (nextInvoiceNumber cast footgun) — VERIFIED live by the lead
  (lib/repos/invoices.ts:215; mock path is regex-safe, SQL path throws on
  any non-numeric suffix). NEW finding → tranche-2 fix pass.
- All four blockers — CLEARED post-report (sandbox keys, whsec via D's own
  capture script, CLI installed, two-scope forwarder running; see the lead
  review's environment section).
- INV-2026-9003 — still seeded and restored to sent/$150 after C's T4 drive;
  reserved for the T6 run, then --cleanup.

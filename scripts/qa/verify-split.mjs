#!/usr/bin/env node
// Prove the marketplace split really happened — from Stripe's side, not ours.
//
//   node --env-file=.env.local scripts/qa/verify-split.mjs
//   node --env-file=.env.local scripts/qa/verify-split.mjs pi_3Abc…   # explicit
//
// The point of this script is that our own stripe_payment_splits row is just a
// claim. It was written by the same code under test, so it cannot be the
// evidence that the code works. This retrieves the PaymentIntent, its charge,
// the application fee, and the transfer FROM STRIPE, prints the arithmetic, and
// then diffs Stripe against what we recorded. A green DB row with no matching
// Stripe transfer is exactly the failure this is here to catch.
//
// Destination-charge shape (tranche 1): one charge on the platform, with
// `application_fee_amount` held back and `transfer_data[destination]` moving
// the remainder to the connected account. So:
//
//     charge.amount  −  application_fee.amount  =  transfer.amount
//     (what the client paid)  (what Liminal keeps)  (what the therapist gets)

import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";

const INVOICE_ID = "00000000-0000-4000-8000-000000009003";

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY not set — nothing to verify against.");
  process.exit(1);
}
if (process.env.STRIPE_SECRET_KEY.includes("_live_")) {
  console.error("Refusing to run against a LIVE key. This tranche is test-mode only.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — run with `node --env-file=.env.local`.");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sql = neon(process.env.DATABASE_URL);
const money = (c, cur = "usd") => `${(c / 100).toFixed(2)} ${cur.toUpperCase()}`;

// ── locate the PaymentIntent ─────────────────────────────────────────────────
let intentId = process.argv[2] && process.argv[2].startsWith("pi_") ? process.argv[2] : null;
let dbSplit = null;

const [split] = await sql`
  SELECT payment_intent_id, checkout_session_id, destination_account_id,
         amount_cents, application_fee_cents, currency, transfer_id
  FROM stripe_payment_splits WHERE invoice_id = ${INVOICE_ID}::uuid
  ORDER BY created_at DESC LIMIT 1
`;
if (split) {
  dbSplit = split;
  intentId ??= split.payment_intent_id;
}
if (!intentId) {
  // Fall back to the plain payments ledger — if the split row is missing but a
  // payment exists, that itself is the finding.
  const [pay] = await sql`
    SELECT stripe_payment_intent FROM payments
    WHERE invoice_id = ${INVOICE_ID}::uuid AND stripe_payment_intent IS NOT NULL
    ORDER BY paid_at DESC LIMIT 1
  `;
  intentId = pay?.stripe_payment_intent ?? null;
  if (intentId) {
    console.log(
      "NOTE: found a payment row but NO stripe_payment_splits row. The invoice settled\n" +
        "      without the marketplace split being recorded — that is a T2 webhook gap.\n",
    );
  }
}
if (!intentId) {
  console.error(
    "No PaymentIntent found for INV-2026-9003.\n" +
      "Either the drive has not reached the payment step, or the webhook never fired\n" +
      "(check that `stripe listen` was running and STRIPE_WEBHOOK_SECRET was set).",
  );
  process.exit(1);
}

// ── retrieve the truth from Stripe ───────────────────────────────────────────
const intent = await stripe.paymentIntents.retrieve(intentId, {
  expand: ["latest_charge", "latest_charge.balance_transaction", "application"],
});
const charge = intent.latest_charge;
if (!charge || typeof charge === "string") {
  console.error(`PaymentIntent ${intentId} has no expanded charge — status=${intent.status}. Not settled.`);
  process.exit(1);
}

console.log(`\nPaymentIntent  ${intent.id}`);
console.log(`  status       ${intent.status}`);
console.log(`  amount       ${money(intent.amount, intent.currency)}`);
console.log(`\nCharge         ${charge.id}`);
console.log(`  paid         ${charge.paid}   captured=${charge.captured}`);
console.log(`  amount       ${money(charge.amount, charge.currency)}`);
console.log(`  app fee      ${charge.application_fee_amount != null ? money(charge.application_fee_amount, charge.currency) : "— (NONE SET)"}`);
console.log(`  destination  ${charge.transfer_data?.destination ?? "— (NO transfer_data — this is NOT a destination charge)"}`);
console.log(`  transfer     ${charge.transfer ?? "— (none yet)"}`);

const problems = [];

if (charge.application_fee_amount == null) {
  problems.push(
    "Charge carries no application_fee_amount. Liminal kept nothing — the platform fee was not applied.",
  );
}
if (!charge.transfer_data?.destination) {
  problems.push(
    "Charge carries no transfer_data.destination. Money stayed on the platform; the therapist was never paid.",
  );
}

// ── the application fee object ───────────────────────────────────────────────
let fee = null;
if (charge.application_fee) {
  fee = await stripe.applicationFees.retrieve(
    typeof charge.application_fee === "string" ? charge.application_fee : charge.application_fee.id,
  );
  console.log(`\nApplicationFee ${fee.id}`);
  console.log(`  amount       ${money(fee.amount, fee.currency)}`);
  console.log(`  refunded     ${fee.refunded}`);
}

// ── the transfer ─────────────────────────────────────────────────────────────
let transfer = null;
if (charge.transfer) {
  transfer = await stripe.transfers.retrieve(typeof charge.transfer === "string" ? charge.transfer : charge.transfer.id);
  console.log(`\nTransfer       ${transfer.id}`);
  console.log(`  amount       ${money(transfer.amount, transfer.currency)}`);
  console.log(`  destination  ${transfer.destination}`);
}

// ── the arithmetic ───────────────────────────────────────────────────────────
if (charge.application_fee_amount != null && transfer) {
  const gross = charge.amount;
  const feeAmt = charge.application_fee_amount;
  const net = transfer.amount;
  const pct = ((feeAmt / gross) * 100).toFixed(2);
  console.log(`\nSPLIT`);
  console.log(`  client paid        ${money(gross, charge.currency)}`);
  console.log(`  Liminal fee        ${money(feeAmt, charge.currency)}   (${pct}% of gross)`);
  console.log(`  therapist receives ${money(net, transfer.currency)}   → ${transfer.destination}`);
  if (gross - feeAmt !== net) {
    problems.push(`Arithmetic does not close: ${gross} − ${feeAmt} = ${gross - feeAmt}, but the transfer moved ${net}.`);
  } else {
    console.log(`  ✓ ${gross} − ${feeAmt} = ${net}`);
  }
  if (pct !== "10.00") {
    problems.push(`Fee is ${pct}%, not the 10% the brief locked. Check the shared fee helper.`);
  }
}

// ── connected-account balance (the therapist's own view) ─────────────────────
const destAcct = charge.transfer_data?.destination ?? transfer?.destination ?? null;
if (destAcct) {
  const acct = await stripe.accounts.retrieve(typeof destAcct === "string" ? destAcct : destAcct.id);
  console.log(`\nConnected account ${acct.id}`);
  console.log(`  charges_enabled  ${acct.charges_enabled}`);
  console.log(`  payouts_enabled  ${acct.payouts_enabled}`);
  console.log(`  details_submitted ${acct.details_submitted}`);
  const due = acct.requirements?.currently_due ?? [];
  if (due.length) console.log(`  currently_due    ${due.join(", ")}`);

  const bal = await stripe.balance.retrieve({ stripeAccount: acct.id });
  for (const b of bal.pending) console.log(`  pending balance  ${money(b.amount, b.currency)}`);
  for (const b of bal.available) console.log(`  available        ${money(b.amount, b.currency)}`);
}

// ── diff Stripe against what WE recorded ─────────────────────────────────────
console.log(`\nOUR RECORD vs STRIPE`);
if (!dbSplit) {
  problems.push("No stripe_payment_splits row for this invoice — the webhook did not record the split.");
  console.log(`  stripe_payment_splits  MISSING`);
} else {
  const checks = [
    ["amount_cents", dbSplit.amount_cents, charge.amount],
    ["application_fee_cents", dbSplit.application_fee_cents, charge.application_fee_amount],
    ["destination_account_id", dbSplit.destination_account_id, typeof destAcct === "string" ? destAcct : destAcct?.id],
    ["transfer_id", dbSplit.transfer_id, transfer?.id ?? null],
  ];
  for (const [name, ours, theirs] of checks) {
    const ok = String(ours ?? "") === String(theirs ?? "");
    console.log(`  ${ok ? "✓" : "✗"} ${name.padEnd(22)} ours=${ours ?? "—"}  stripe=${theirs ?? "—"}`);
    if (!ok) problems.push(`stripe_payment_splits.${name} disagrees with Stripe (ours=${ours}, stripe=${theirs}).`);
  }
}

// Invoice status + the event ledger.
const [inv] = await sql`SELECT number, status FROM invoices WHERE id = ${INVOICE_ID}::uuid`;
console.log(`  invoice                ${inv?.number ?? "—"} status=${inv?.status ?? "—"}`);
if (inv && inv.status !== "paid") {
  problems.push(`Invoice ${inv.number} is still '${inv.status}' — the webhook did not settle it.`);
}

const events = await sql`
  SELECT id, type, stripe_account_id, processed_at, error FROM stripe_events ORDER BY received_at DESC LIMIT 10
`;
console.log(`\nstripe_events (latest ${events.length})`);
for (const e of events) {
  const state = e.error ? `ERROR ${e.error}` : e.processed_at ? "processed" : "UNPROCESSED";
  console.log(`  ${e.type.padEnd(32)} ${(e.stripe_account_id ?? "platform").padEnd(24)} ${state}`);
  if (e.error) problems.push(`Event ${e.id} (${e.type}) recorded an error: ${e.error}`);
  if (!e.processed_at && !e.error) problems.push(`Event ${e.id} (${e.type}) was claimed but never completed.`);
}

// ── verdict ──────────────────────────────────────────────────────────────────
console.log("");
if (problems.length) {
  console.log(`VERDICT: ${problems.length} problem(s)\n`);
  problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  console.log("");
  process.exit(1);
}
console.log("VERDICT: split verified end to end — Stripe and our ledger agree.\n");

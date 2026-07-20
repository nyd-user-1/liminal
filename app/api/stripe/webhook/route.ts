import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { logEvent } from "@/lib/audit";
import { sendDisputeAlert, sendPaymentReceipt, sendTherapistPaid } from "@/lib/email/stripe-notifications";
import { getInvoice, recordPayment } from "@/lib/repos/invoices";
import {
  claimStripeEvent,
  completeStripeEvent,
  connectAccountContact,
  recordPaymentSplit,
  syncConnectAccount,
} from "@/lib/repos/stripe-connect";
import { getStripe } from "@/lib/stripe";

/**
 * Stripe webhook — the authoritative record of everything that happens to money.
 * The confirm-on-redirect path is only a UX convenience; an invoice is settled
 * here, on a SIGNED payload Stripe actually sent.
 *
 * TWO EVENT SCOPES arrive at this one URL and both matter:
 *   - PLATFORM scope: checkout.session.completed, charge.dispute.created —
 *     `event.account` is undefined.
 *   - CONNECTED scope: account.updated, payout.paid/failed — `event.account` is
 *     the acct_… the event is about.
 * `stripe listen` must subscribe to both or half of these silently never arrive.
 *
 * IDEMPOTENCY: every event is claimed in stripe_events before any side effect
 * runs. Stripe retries, and it also delivers the same event to multiple
 * listeners; without the claim, a redelivered checkout.session.completed would
 * record a second payment. A claim that wins but then throws leaves
 * processed_at NULL — an unfinished event is visible as a worklist row, not
 * lost and not silently "handled".
 *
 * SETUP: STRIPE_WEBHOOK_SECRET must be set. Without key + secret we 503 —
 * never accept an unverifiable event. The raw body (req.text(), not req.json())
 * is required for signature verification.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    console.error("[stripe] webhook: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe] webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // Claim before doing anything. A lost race here is the correct outcome: the
  // other delivery is doing the work.
  const claimed = await claimStripeEvent({
    id: event.id,
    type: event.type,
    stripeAccountId: event.account ?? null,
    payload: event,
  });
  if (!claimed) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "payout.paid":
      case "payout.failed":
        await handlePayout(event.type, event.data.object as Stripe.Payout, event.account ?? null);
        break;
      case "charge.dispute.created":
        await handleDispute(event.data.object as Stripe.Dispute);
        break;
      default:
        break; // everything else is recorded but not acted on
    }
    await completeStripeEvent(event.id);
  } catch (err) {
    // Record WHY it failed, then still 200: Stripe's retry storm doesn't help
    // when the failure is in our own handler, and the unfinished row is the
    // durable signal that something needs a human.
    console.error(`[stripe] webhook handler error (${event.type} ${event.id}):`, err);
    await completeStripeEvent(event.id, err instanceof Error ? err.message : String(err));
  }
  return NextResponse.json({ received: true });
}

/**
 * Settlement. Records the payment against the invoice (the pre-marketplace
 * behavior, unchanged), and — when the charge was a destination charge — also
 * records the marketplace split and sends the two receipts.
 */
async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  const invoiceId = session.client_reference_id || (session.metadata?.invoiceId as string | undefined);
  if (!invoiceId) return;

  const intentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return;

  // Dedupe against the confirm-on-redirect path, which may have recorded this
  // same intent moments earlier.
  const alreadyRecorded = intentId && invoice.payments.some((p) => p.stripePaymentIntent === intentId);
  if (invoice.balanceCents > 0 && !alreadyRecorded) {
    const result = await recordPayment(invoiceId, {
      amountCents: Math.min(session.amount_total ?? invoice.balanceCents, invoice.balanceCents),
      method: "card",
      stripePaymentIntent: intentId,
    });
    await logEvent({
      actorId: null,
      action: "payment.record",
      entity: "payment",
      entityId: result?.payment.id ?? null,
      meta: { invoice: invoiceId, number: invoice.number, mode: "stripe_webhook" },
    });
  }

  if (!intentId) return;

  // Was this a marketplace (destination) charge? Retrieve the intent rather than
  // trusting the session: transfer_data and the final application fee live on
  // the intent/charge, and the charge is where the transfer id appears.
  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
  const destination =
    typeof intent.transfer_data?.destination === "string"
      ? intent.transfer_data.destination
      : (intent.transfer_data?.destination?.id ?? null);
  if (!destination) return; // platform-only charge — nothing to split

  const charge = intent.latest_charge as Stripe.Charge | null;
  const grossCents = intent.amount_received || intent.amount;
  const feeCents = intent.application_fee_amount ?? 0;

  await recordPaymentSplit({
    invoiceId,
    paymentIntentId: intent.id,
    checkoutSessionId: session.id,
    destinationAccountId: destination,
    amountCents: grossCents,
    applicationFeeCents: feeCents,
    currency: intent.currency ?? "usd",
    transferId: typeof charge?.transfer === "string" ? charge.transfer : (charge?.transfer?.id ?? null),
  });
  await logEvent({
    actorId: null,
    action: "payment.split_record",
    entity: "invoice",
    entityId: invoiceId,
    meta: {
      number: invoice.number,
      destination,
      amount_cents: grossCents,
      application_fee_cents: feeCents,
    },
  });

  // Notifications are best-effort and must never fail the webhook.
  const payee = await connectAccountContact(destination);
  if (invoice.client?.email) {
    await sendPaymentReceipt({
      to: invoice.client.email,
      firstName: invoice.client.firstName,
      amountCents: grossCents,
      invoiceNumber: invoice.number,
      invoiceId,
      practitionerName: payee?.name ?? "your therapist",
    });
  }
  if (payee?.email) {
    await sendTherapistPaid({
      to: payee.email,
      practitionerName: payee.name,
      split: { grossCents, feeCents, netCents: grossCents - feeCents },
      invoiceNumber: invoice.number,
      clientName: invoice.client ? `${invoice.client.firstName} ${invoice.client.lastName}` : null,
    });
  }
}

/** Capability sync — the one write that decides whether checkout is offered. */
async function handleAccountUpdated(account: Stripe.Account) {
  const synced = await syncConnectAccount(account.id, {
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    requirementsDue: (account.requirements as Record<string, unknown> | undefined) ?? null,
    businessType: (account.business_type as "individual" | "company" | null) ?? null,
  });
  // An account.updated for an account we have no row for is not an error — it
  // can be a platform-level account or one created outside this flow.
  if (!synced) return;
  await logEvent({
    actorId: null,
    action: "connect.account_updated",
    entity: "stripe_connect_account",
    entityId: synced.id,
    meta: {
      stripeAccount: account.id,
      chargesEnabled: synced.chargesEnabled,
      payoutsEnabled: synced.payoutsEnabled,
    },
  });
}

/** Payout lifecycle on the connected account — recorded, not yet surfaced. */
async function handlePayout(type: string, payout: Stripe.Payout, accountId: string | null) {
  await logEvent({
    actorId: null,
    action: type === "payout.paid" ? "connect.payout_paid" : "connect.payout_failed",
    entity: "stripe_connect_account",
    entityId: null,
    meta: {
      stripeAccount: accountId,
      payout: payout.id,
      amount_cents: payout.amount,
      failure_code: payout.failure_code ?? null,
    },
  });
}

/**
 * Dispute opened. With controller.losses.payments = application, the loss is
 * OURS, not the therapist's — so this alerts the practice, not the clinician.
 */
async function handleDispute(dispute: Stripe.Dispute) {
  await logEvent({
    actorId: null,
    action: "payment.dispute_created",
    entity: "payment",
    entityId: null,
    meta: { dispute: dispute.id, amount_cents: dispute.amount, reason: dispute.reason },
  });
  await sendDisputeAlert({
    amountCents: dispute.amount,
    reason: dispute.reason,
    disputeId: dispute.id,
    dueBy: dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
      : null,
  });
}

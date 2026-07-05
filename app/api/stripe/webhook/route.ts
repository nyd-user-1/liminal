import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { logEvent } from "@/lib/audit";
import { getInvoice, recordPayment } from "@/lib/repos/invoices";
import { getStripe } from "@/lib/stripe";

/**
 * Stripe webhook — the authoritative record of an online payment (tariffs
 * pattern). The confirm-on-redirect path is only a UX convenience; this
 * endpoint receives a SIGNED payload server-to-server, so an invoice is only
 * settled on a payment event Stripe actually sent.
 *
 * Handles checkout.session.completed (payment_status === "paid") → record the
 * payment (deduped against confirm by payment intent) and mark the invoice
 * paid.
 *
 * SETUP: point a Stripe webhook at this URL and set STRIPE_WEBHOOK_SECRET.
 * Without key + secret we 503 — never accept an unverifiable event. The raw
 * body (req.text(), not req.json()) is required for signature verification.
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

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.client_reference_id || (session.metadata?.invoiceId as string | undefined);
      if (invoiceId && session.payment_status === "paid") {
        const intent =
          typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
        const invoice = await getInvoice(invoiceId);
        const alreadyRecorded = intent && invoice?.payments.some((p) => p.stripePaymentIntent === intent);
        if (invoice && invoice.balanceCents > 0 && !alreadyRecorded) {
          const result = await recordPayment(invoiceId, {
            amountCents: Math.min(session.amount_total ?? invoice.balanceCents, invoice.balanceCents),
            method: "card",
            stripePaymentIntent: intent,
          });
          await logEvent({
            actorId: null,
            action: "payment.record",
            entity: "payment",
            entityId: result?.payment.id ?? null,
            meta: { invoice: invoiceId, number: invoice.number, mode: "stripe_webhook" },
          });
        }
      }
    }
    // Everything else is ignored — only settlement events matter here.
  } catch (err) {
    // Log but still 200 so Stripe doesn't hammer retries on a transient blip.
    console.error("[stripe] webhook handler error:", err);
  }
  return NextResponse.json({ received: true });
}

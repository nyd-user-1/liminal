import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { getInvoice, recordPayment } from "@/lib/repos/invoices";
import { getStripe } from "@/lib/stripe";

/**
 * Checkout success_url target — a UX fast-path, not the source of truth
 * (tariffs pattern; the webhook is the authoritative backstop for live keys).
 *
 *  - MOCK (?mock=1&invoice_id=…, only honored when no Stripe key is set):
 *    records a card payment for the outstanding balance — recordPayment flips
 *    the invoice to paid — then redirects to the invoice with ?paid=1.
 *    Requires a signed-in user so it can't be curl'd anonymously.
 *
 *  - LIVE (?session_id=…): re-fetches the session from Stripe server-to-server
 *    and only records the payment when Stripe itself reports
 *    payment_status === "paid". Deduped against the webhook by payment intent.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const stripe = getStripe();

  // ── MOCK confirm ────────────────────────────────────────────────────────────
  if (!stripe && req.nextUrl.searchParams.get("mock") === "1") {
    const invoiceId = req.nextUrl.searchParams.get("invoice_id");
    const user = await getUser();
    if (!invoiceId || !user) return NextResponse.redirect(`${origin}/billing`, 303);
    const invoice = await getInvoice(invoiceId);
    if (invoice && invoice.balanceCents > 0 && invoice.status !== "void") {
      const result = await recordPayment(invoiceId, {
        amountCents: invoice.balanceCents,
        method: "card",
        stripePaymentIntent: `pi_mock_${Date.now()}`,
      });
      await logEvent({
        actorId: user.id,
        action: "payment.record",
        entity: "payment",
        entityId: result?.payment.id ?? null,
        meta: { invoice: invoiceId, number: invoice.number, amount_cents: invoice.balanceCents, method: "card", mode: "mock" },
      });
    }
    return NextResponse.redirect(`${origin}/billing/${invoiceId}?paid=1`, 303);
  }

  // ── LIVE confirm ────────────────────────────────────────────────────────────
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!stripe || !sessionId) return NextResponse.redirect(`${origin}/billing`, 303);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const invoiceId = session.client_reference_id || (session.metadata?.invoiceId as string | undefined);
    if (invoiceId && session.payment_status === "paid") {
      const intent = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
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
          meta: { invoice: invoiceId, number: invoice.number, mode: "stripe_confirm" },
        });
      }
      return NextResponse.redirect(`${origin}/billing/${invoiceId}?paid=1`, 303);
    }
    if (invoiceId) return NextResponse.redirect(`${origin}/billing/${invoiceId}`, 303);
  } catch (err) {
    console.error("[stripe] confirm error:", err);
  }
  return NextResponse.redirect(`${origin}/billing`, 303);
}

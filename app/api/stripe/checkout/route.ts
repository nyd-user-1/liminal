import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { getInvoice, updateInvoice } from "@/lib/repos/invoices";
import { GENERIC_LINE_ITEM_NAME, getStripe } from "@/lib/stripe";

/**
 * Collect an invoice online. Two paths, chosen by whether a Stripe key is
 * present (tariffs pattern):
 *
 *  - LIVE (STRIPE_SECRET_KEY set): create a one-time-payment Checkout Session
 *    for the invoice balance and return its { url }. success_url →
 *    /api/stripe/confirm which verifies payment server-to-server and records
 *    it; the webhook is the authoritative backstop.
 *
 *  - MOCK (no key): return { url, mock: true } pointing at
 *    /api/stripe/confirm?mock=1&invoice_id=… — a fake "success redirect" that
 *    records a card payment for the balance and marks the invoice paid. This
 *    makes the whole collect flow demoable with zero Stripe config. Refused in
 *    a real production deploy (NODE_ENV=production + a real DB attached),
 *    where a missing key is a misconfiguration, not a free-paid button.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    const body = await req.json().catch(() => null);
    const invoiceId = typeof body?.invoiceId === "string" ? body.invoiceId : null;
    if (!invoiceId) return NextResponse.json({ error: "invoiceId is required." }, { status: 400 });

    const invoice = await getInvoice(invoiceId);
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    if (invoice.status === "void" || invoice.status === "paid" || invoice.balanceCents <= 0) {
      return NextResponse.json({ error: "This invoice has no balance to collect." }, { status: 400 });
    }

    const stripe = getStripe();
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;

    // ── MOCK checkout (no Stripe key in this environment) ─────────────────────
    if (!stripe) {
      if (process.env.NODE_ENV === "production" && hasDb) {
        console.error("[stripe] checkout: no STRIPE_SECRET_KEY in production");
        return NextResponse.json(
          { error: "Online payments are not configured. Add STRIPE_SECRET_KEY." },
          { status: 503 },
        );
      }
      await logEvent({
        actorId: user.id,
        action: "invoice.checkout_started",
        entity: "invoice",
        entityId: invoiceId,
        meta: { number: invoice.number, mode: "mock" },
      });
      return NextResponse.json({
        url: `${origin}/api/stripe/confirm?mock=1&invoice_id=${invoiceId}`,
        mock: true,
      });
    }

    // ── LIVE Stripe Checkout ───────────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: invoice.balanceCents,
            // PHI GUARDRAIL: this used to send every invoice line description
            // to Stripe, which is where service names ("EMDR session",
            // "Psychiatric diagnostic evaluation") live. Stripe signs no BAA,
            // so a Checkout line item may not carry clinical content. Invoice
            // number identifies the bill; our own records say what it was for.
            product_data: { name: `${invoice.number} — ${GENERIC_LINE_ITEM_NAME}` },
          },
        },
      ],
      customer_email: invoice.client?.email ?? undefined,
      client_reference_id: invoiceId,
      metadata: { invoiceId, number: invoice.number },
      success_url: `${origin}/api/stripe/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/${invoiceId}?canceled=1`,
    });
    await updateInvoice(invoiceId, { stripeCheckoutId: session.id });
    await logEvent({
      actorId: user.id,
      action: "invoice.checkout_started",
      entity: "invoice",
      entityId: invoiceId,
      meta: { number: invoice.number, mode: "live", session: session.id },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[stripe] checkout error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}

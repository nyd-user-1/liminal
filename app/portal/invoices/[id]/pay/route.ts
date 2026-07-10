import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { sendPaymentReceiptEmail } from "@/lib/email";
import { getInvoice, recordPayment } from "@/lib/repos/invoices";
import { clientForUser } from "@/lib/repos/threads";
import { getStripe } from "@/lib/stripe";

/**
 * Portal "Pay" — the client-side counterpart of /api/stripe/checkout (that
 * route is practitioner-only "collect"). Scoped to the caller's own invoices
 * via clients.user_id.
 *
 *  - LIVE (STRIPE_SECRET_KEY): create a Checkout Session for the balance and
 *    return { url }; the webhook records the payment (authoritative backstop).
 *  - MOCK (no key): record a card payment for the balance right here and
 *    return { paid: true } — keeps the demo flow inside the portal instead of
 *    bouncing through practitioner-only /billing redirects.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("client");
    const { id } = await params;
    const client = await clientForUser(user.id);
    const invoice = await getInvoice(id);
    if (!client || !invoice || invoice.clientId !== client.id) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (invoice.status === "void" || invoice.balanceCents <= 0) {
      return NextResponse.json({ error: "This invoice has no balance to pay." }, { status: 400 });
    }

    const stripe = getStripe();
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;

    if (!stripe) {
      const result = await recordPayment(id, {
        amountCents: invoice.balanceCents,
        method: "card",
        stripePaymentIntent: `pi_mock_${Date.now()}`,
      });
      await logEvent({
        actorId: user.id,
        action: "payment.record",
        entity: "payment",
        entityId: result?.payment.id ?? null,
        meta: { invoice: id, number: invoice.number, amount_cents: invoice.balanceCents, method: "card", mode: "portal_mock" },
      });
      if (invoice.client?.email) {
        await sendPaymentReceiptEmail({
          to: invoice.client.email,
          firstName: invoice.client.firstName,
          number: invoice.number,
          amountCents: invoice.balanceCents,
          balanceCents: result?.invoice.balanceCents ?? 0,
          invoiceId: id,
        });
      }
      return NextResponse.json({ paid: true });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: invoice.balanceCents,
            product_data: { name: `${invoice.number} — Liminal Psychiatry` },
          },
        },
      ],
      customer_email: invoice.client?.email ?? undefined,
      client_reference_id: id,
      metadata: { invoiceId: id, number: invoice.number },
      // Through /api/stripe/confirm so the payment is recorded on redirect
      // even where webhooks can't reach (local dev); ?portal=1 sends the
      // client back to their invoices, not the practitioner workspace.
      success_url: `${origin}/api/stripe/confirm?session_id={CHECKOUT_SESSION_ID}&portal=1`,
      cancel_url: `${origin}/portal/invoices?canceled=1`,
    });
    await logEvent({
      actorId: user.id,
      action: "invoice.checkout_started",
      entity: "invoice",
      entityId: id,
      meta: { number: invoice.number, mode: "portal_live", session: session.id },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

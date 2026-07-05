import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { getInvoice, recordPayment } from "@/lib/repos/invoices";
import type { PaymentMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

const METHODS: PaymentMethod[] = ["card", "cash", "insurance", "other"];

export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const invoiceId = req.nextUrl.searchParams.get("invoiceId");
    if (!invoiceId) return NextResponse.json({ error: "invoiceId is required." }, { status: 400 });
    const invoice = await getInvoice(invoiceId);
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    return NextResponse.json({ payments: invoice.payments });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { invoiceId, amountCents, method } = body as {
      invoiceId?: string;
      amountCents?: number;
      method?: string;
    };
    if (!invoiceId) return NextResponse.json({ error: "invoiceId is required." }, { status: 400 });
    const amount = Math.round(Number(amountCents));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amountCents must be a positive number." }, { status: 400 });
    }
    if (!METHODS.includes(method as PaymentMethod)) {
      return NextResponse.json({ error: "method must be card, cash, insurance, or other." }, { status: 400 });
    }
    const existing = await getInvoice(invoiceId);
    if (!existing) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    if (existing.status === "void") {
      return NextResponse.json({ error: "Payments can't be recorded on a void invoice." }, { status: 400 });
    }

    const result = await recordPayment(invoiceId, { amountCents: amount, method: method as PaymentMethod });
    if (!result) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    await logEvent({
      actorId: user.id,
      action: "payment.record",
      entity: "payment",
      entityId: result.payment.id,
      meta: { invoice: invoiceId, number: existing.number, amount_cents: amount, method },
    });
    return NextResponse.json({ payment: result.payment, invoice: result.invoice }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

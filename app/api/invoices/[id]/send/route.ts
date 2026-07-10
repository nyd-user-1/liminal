import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { sendInvoiceEmail } from "@/lib/email";
import { getInvoice, updateInvoice } from "@/lib/repos/invoices";

// Email an invoice to the client (Resend) — marks a draft sent (stamping
// issued_on) and sends the document-style summary with a "View & pay" portal
// deep link. `to` is editable in the Send modal because Resend's dev sender
// only delivers to the account owner's inbox; it defaults to the client's
// email on file. Returns { emailed:false } when no Resend key is configured
// so the UI can say "marked sent, email not configured" instead of lying.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    let invoice = await getInvoice(id);
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    if (invoice.status === "void") {
      return NextResponse.json({ error: "A void invoice can't be sent." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const to = (typeof body?.to === "string" && body.to.trim()) || invoice.client?.email || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { error: "No valid recipient — add an email to the client record or enter one." },
        { status: 400 },
      );
    }

    if (invoice.status === "draft") {
      invoice =
        (await updateInvoice(id, {
          status: "sent",
          ...(invoice.issuedOn ? {} : { issuedOn: new Date().toISOString().slice(0, 10) }),
        })) ?? invoice;
    }

    const emailed = await sendInvoiceEmail({
      to,
      firstName: invoice.client?.firstName ?? invoice.clientName.split(" ")[0],
      number: invoice.number,
      items: invoice.items.map((it) => ({ description: it.description, qty: it.qty, amountCents: it.amountCents })),
      totalCents: invoice.totalCents,
      balanceCents: invoice.balanceCents,
      dueOn: invoice.dueOn,
      invoiceId: id,
    });

    await logEvent({
      actorId: user.id,
      action: "invoice.email_sent",
      entity: "invoice",
      entityId: id,
      meta: { number: invoice.number, emailed }, // no recipient address — PHI stays out of the audit log
    });
    return NextResponse.json({ emailed, to, invoice });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[invoices] send error:", err);
    return NextResponse.json({ error: "Could not send the invoice." }, { status: 500 });
  }
}

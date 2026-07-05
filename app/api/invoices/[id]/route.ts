import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { getInvoice, updateInvoice } from "@/lib/repos/invoices";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireRole("practitioner");
    const { id } = await params;
    const invoice = await getInvoice(id);
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const existing = await getInvoice(id);
    if (!existing) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { status, dueOn } = body as { status?: string; dueOn?: string | null };

    // Status changes are limited to the workflow actions: mark sent · void.
    if (status !== undefined && status !== "sent" && status !== "void") {
      return NextResponse.json({ error: "status must be 'sent' or 'void'." }, { status: 400 });
    }
    if (status === "sent" && existing.status !== "draft" && existing.status !== "overdue") {
      return NextResponse.json({ error: `A ${existing.status} invoice can't be marked sent.` }, { status: 400 });
    }
    if (status === "void" && existing.status === "paid") {
      return NextResponse.json({ error: "A paid invoice can't be voided." }, { status: 400 });
    }

    const invoice = await updateInvoice(id, {
      ...(status ? { status: status as "sent" | "void" } : {}),
      ...(status === "sent" && !existing.issuedOn ? { issuedOn: new Date().toISOString().slice(0, 10) } : {}),
      ...(dueOn !== undefined ? { dueOn } : {}),
    });
    if (status) {
      await logEvent({
        actorId: user.id,
        action: status === "sent" ? "invoice.send" : "invoice.void",
        entity: "invoice",
        entityId: id,
        meta: { number: existing.number, total_cents: existing.totalCents },
      });
    }
    return NextResponse.json({ invoice });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

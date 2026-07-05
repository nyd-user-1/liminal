import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { createInvoice, listInvoices } from "@/lib/repos/invoices";
import type { InvoiceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "void"];

export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const clientId = req.nextUrl.searchParams.get("clientId") ?? undefined;
    const statusParam = req.nextUrl.searchParams.get("status");
    const status = STATUSES.find((s) => s === statusParam);
    const invoices = await listInvoices({ clientId, status });
    return NextResponse.json({ invoices });
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
    const { clientId, dueOn, issuedOn, appointmentId, status, items } = body as {
      clientId?: string;
      dueOn?: string | null;
      issuedOn?: string | null;
      appointmentId?: string | null;
      status?: string;
      items?: Array<{ description?: string; qty?: number; unitCents?: number }>;
    };
    if (!clientId || typeof clientId !== "string") {
      return NextResponse.json({ error: "clientId is required." }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one line item is required." }, { status: 400 });
    }
    const clean = items.map((it) => ({
      description: typeof it.description === "string" ? it.description.trim() : "",
      qty: Number(it.qty),
      unitCents: Math.round(Number(it.unitCents)),
    }));
    for (const it of clean) {
      if (!it.description) return NextResponse.json({ error: "Every item needs a description." }, { status: 400 });
      if (!Number.isFinite(it.qty) || it.qty <= 0 || !Number.isInteger(it.qty)) {
        return NextResponse.json({ error: "Item qty must be a positive whole number." }, { status: 400 });
      }
      if (!Number.isFinite(it.unitCents) || it.unitCents < 0) {
        return NextResponse.json({ error: "Item unit price must be zero or more." }, { status: 400 });
      }
    }
    const invoice = await createInvoice({
      clientId,
      appointmentId: appointmentId ?? null,
      issuedOn: issuedOn ?? null,
      dueOn: dueOn ?? null,
      status: status === "sent" ? "sent" : "draft",
      items: clean,
    });
    await logEvent({
      actorId: user.id,
      action: "invoice.create",
      entity: "invoice",
      entityId: invoice.id,
      meta: { number: invoice.number, total_cents: invoice.totalCents },
    });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

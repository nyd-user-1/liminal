import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { deletePayer, getPayer, updatePayer } from "@/lib/repos/payers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const patch: { name?: string; payerCode?: string } = {};
    if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim();
    if (typeof body?.payerCode === "string" && body.payerCode.trim()) patch.payerCode = body.payerCode.trim();
    if (!patch.name && !patch.payerCode) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    const payer = await updatePayer(id, patch);
    if (!payer) return NextResponse.json({ error: "Payer not found." }, { status: 404 });
    await logEvent({ actorId: user.id, action: "payer.update", entity: "payer", entityId: id, meta: null });
    return NextResponse.json({ payer });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const existing = await getPayer(id);
    if (!existing) return NextResponse.json({ error: "Payer not found." }, { status: 404 });
    await deletePayer(id);
    await logEvent({
      actorId: user.id,
      action: "payer.delete",
      entity: "payer",
      entityId: id,
      meta: { payer_code: existing.payerCode },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

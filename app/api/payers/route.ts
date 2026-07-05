import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { createPayer, listPayers } from "@/lib/repos/payers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("practitioner");
    const payers = await listPayers();
    return NextResponse.json({ payers });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const payerCode = typeof body?.payerCode === "string" ? body.payerCode.trim() : "";
    if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });
    if (!payerCode) return NextResponse.json({ error: "payerCode is required." }, { status: 400 });
    const payer = await createPayer({ name, payerCode });
    await logEvent({
      actorId: user.id,
      action: "payer.create",
      entity: "payer",
      entityId: payer.id,
      meta: { payer_code: payerCode },
    });
    return NextResponse.json({ payer }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

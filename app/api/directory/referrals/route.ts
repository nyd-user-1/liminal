import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { createReferral, listReferrals } from "@/lib/repos/directory";

export const dynamic = "force-dynamic";

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/** GET /api/directory/referrals?clientId= — a client's referrals. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId is required." }, { status: 400 });
    const referrals = await listReferrals({ clientId });
    return NextResponse.json({ referrals });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

/** POST /api/directory/referrals — refer a client to a provider or program. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    const body = await req.json().catch(() => null);
    const clientId = typeof body?.clientId === "string" ? body.clientId : "";
    const providerId = body?.providerId || null;
    const programId = body?.programId || null;
    if (!clientId || (!providerId && !programId)) {
      return NextResponse.json({ error: "A client and a provider or program are required." }, { status: 400 });
    }
    const referral = await createReferral({
      clientId,
      providerId,
      programId,
      reason: body?.reason?.trim() || null,
      createdBy: user.id,
    });
    await logEvent({
      actorId: user.id,
      action: "referral.create",
      entity: "referral",
      entityId: referral.id,
      meta: { clientId, providerId, programId },
    });
    return NextResponse.json({ referral }, { status: 201 });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { createPolicy, listPolicies } from "@/lib/repos/policies";

export const dynamic = "force-dynamic";

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/** GET /api/policies?clientId= — a client's insurance policies (audited). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId is required." }, { status: 400 });
    const policies = await listPolicies(clientId);
    await logEvent({ actorId: user.id, action: "policy.list", entity: "client", entityId: clientId });
    return NextResponse.json({ policies });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

/** POST /api/policies — add an insurance policy to a client. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    const body = await req.json().catch(() => null);
    const clientId = typeof body?.clientId === "string" ? body.clientId : "";
    const payerId = typeof body?.payerId === "string" ? body.payerId : "";
    const memberId = typeof body?.memberId === "string" ? body.memberId.trim() : "";
    if (!clientId || !payerId || !memberId) {
      return NextResponse.json({ error: "clientId, payerId and memberId are required." }, { status: 400 });
    }
    const copay = Number(body?.copayCents);
    const policy = await createPolicy({
      clientId,
      payerId,
      memberId,
      groupId: body?.groupId?.trim() || null,
      kind: body?.kind === "secondary" ? "secondary" : "primary",
      status: ["verified", "unverified", "inactive"].includes(body?.status) ? body.status : undefined,
      copayCents: Number.isFinite(copay) && copay >= 0 ? Math.round(copay) : null,
    });
    await logEvent({
      actorId: user.id,
      action: "policy.create",
      entity: "insurance_policy",
      entityId: policy.id,
      meta: { clientId },
    });
    return NextResponse.json({ policy }, { status: 201 });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

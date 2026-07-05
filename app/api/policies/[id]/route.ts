import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { deletePolicy, updatePolicy, type UpdatePolicyPatch } from "@/lib/repos/policies";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/** PATCH /api/policies/[id] — edit / verify / archive a policy. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body." }, { status: 400 });
    }
    const patch: UpdatePolicyPatch = {};
    if (typeof body.payerId === "string" && body.payerId) patch.payerId = body.payerId;
    if (typeof body.memberId === "string" && body.memberId.trim()) patch.memberId = body.memberId.trim();
    if ("groupId" in body) patch.groupId = body.groupId?.trim() || null;
    if (body.kind === "primary" || body.kind === "secondary") patch.kind = body.kind;
    if (["verified", "unverified", "inactive"].includes(body.status)) patch.status = body.status;
    if ("copayCents" in body) {
      const copay = Number(body.copayCents);
      patch.copayCents = Number.isFinite(copay) && copay >= 0 ? Math.round(copay) : null;
    }
    const policy = await updatePolicy(id, patch);
    if (!policy) return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    await logEvent({
      actorId: user.id,
      action: "policy.update",
      entity: "insurance_policy",
      entityId: id,
      meta: { fields: Object.keys(patch) },
    });
    return NextResponse.json({ policy });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

/** DELETE /api/policies/[id] — remove a policy. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const ok = await deletePolicy(id);
    if (!ok) return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    await logEvent({ actorId: user.id, action: "policy.delete", entity: "insurance_policy", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

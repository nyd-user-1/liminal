import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { createPolicy, getPolicy, updatePolicy } from "@/lib/repos/policies";
import { clientForUser } from "@/lib/repos/threads";

export const dynamic = "force-dynamic";

// Portal self-service on the client's own insurance. Client-entered details
// always land as "unverified" — the practice verifies before billing.

function fail(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** Add a policy to the caller's own client record. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("client");
    const client = await clientForUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record for this login." }, { status: 403 });

    const body = (await req.json()) as { payerId?: string; memberId?: string; groupId?: string; kind?: string };
    const payerId = body.payerId?.trim();
    const memberId = body.memberId?.trim();
    if (!payerId || !memberId) {
      return NextResponse.json({ error: "Insurer and member ID are required." }, { status: 400 });
    }

    const policy = await createPolicy({
      clientId: client.id,
      payerId,
      memberId,
      groupId: body.groupId?.trim() || null,
      kind: body.kind === "secondary" ? "secondary" : "primary",
      status: "unverified",
    });
    await logEvent({ actorId: user.id, action: "policy.create", entity: "insurance_policy", entityId: policy.id, meta: { via: "portal" } });
    return NextResponse.json(policy, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

/** Update one of the caller's own policies (member/group/payer → back to unverified). */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole("client");
    const client = await clientForUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record for this login." }, { status: 403 });

    const body = (await req.json()) as { id?: string; payerId?: string; memberId?: string; groupId?: string };
    if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });
    const existing = await getPolicy(body.id);
    if (!existing || existing.clientId !== client.id) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const memberId = body.memberId?.trim();
    const updated = await updatePolicy(body.id, {
      payerId: body.payerId?.trim() || undefined,
      memberId: memberId || undefined,
      groupId: body.groupId === undefined ? undefined : body.groupId.trim() || null,
      status: "unverified",
    });
    await logEvent({ actorId: user.id, action: "policy.update", entity: "insurance_policy", entityId: body.id, meta: { via: "portal" } });
    return NextResponse.json(updated);
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { updateClient } from "@/lib/repos/clients";
import { clientForUser } from "@/lib/repos/threads";

export const dynamic = "force-dynamic";

// Portal self-service on the client's own demographics. Name and email stay
// staff-managed (email is the portal login identity).

const EDITABLE = ["phone", "address", "dob", "gender", "pronouns"] as const;

function fail(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole("client");
    const client = await clientForUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record for this login." }, { status: 403 });

    const body = (await req.json()) as Record<string, unknown>;
    const patch: Record<string, string | null> = {};
    for (const key of EDITABLE) {
      if (!(key in body)) continue;
      const v = body[key];
      if (v !== null && typeof v !== "string") {
        return NextResponse.json({ error: `Invalid value for ${key}.` }, { status: 400 });
      }
      patch[key] = typeof v === "string" ? v.trim() || null : null;
    }
    if (patch.dob && !/^\d{4}-\d{2}-\d{2}$/.test(patch.dob)) {
      return NextResponse.json({ error: "Date of birth must be YYYY-MM-DD." }, { status: 400 });
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await updateClient(client.id, patch);
    await logEvent({ actorId: user.id, action: "client.update", entity: "client", entityId: client.id, meta: { via: "portal", fields: Object.keys(patch) } });
    return NextResponse.json(updated);
  } catch (e) {
    return fail(e);
  }
}

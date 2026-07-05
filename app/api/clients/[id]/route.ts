import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getClient, updateClient, type UpdateClientPatch } from "@/lib/repos/clients";
import type { ClientStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: ClientStatus[] = ["lead", "active", "archived"];

type Params = { params: Promise<{ id: string }> };

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/** GET /api/clients/[id] — one client record (PHI read, audited). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const client = await getClient(id);
    if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    await logEvent({ actorId: user.id, action: "client.view", entity: "client", entityId: id });
    return NextResponse.json({ client });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

/** PATCH /api/clients/[id] — update demographics/status/tags. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body." }, { status: 400 });
    }
    const patch: UpdateClientPatch = {};
    if (typeof body.firstName === "string" && body.firstName.trim()) patch.firstName = body.firstName.trim();
    if (typeof body.lastName === "string" && body.lastName.trim()) patch.lastName = body.lastName.trim();
    for (const key of ["dob", "email", "phone", "address", "gender", "pronouns"] as const) {
      if (key in body) patch[key] = typeof body[key] === "string" && body[key] ? body[key] : null;
    }
    if ("primaryPractitionerId" in body) patch.primaryPractitionerId = body.primaryPractitionerId || null;
    if ("status" in body) {
      if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      patch.status = body.status;
    }
    if ("tags" in body) {
      patch.tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string" && t) : [];
    }
    const client = await updateClient(id, patch);
    if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    await logEvent({
      actorId: user.id,
      action: "client.update",
      entity: "client",
      entityId: id,
      meta: { fields: Object.keys(patch) },
    });
    return NextResponse.json({ client });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { deleteLocation, updateLocation, type CreateLocationInput } from "@/lib/repos/services";
import type { LocationKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS: LocationKind[] = ["office", "telehealth"];

type Params = { params: Promise<{ id: string }> };

function authResponse(e: unknown): NextResponse | null {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  return null;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const patch: Partial<CreateLocationInput> = {};
    if ("name" in body) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "name must be a non-empty string." }, { status: 400 });
      }
      patch.name = body.name.trim();
    }
    if ("kind" in body) {
      if (typeof body.kind !== "string" || !KINDS.includes(body.kind as LocationKind)) {
        return NextResponse.json({ error: "kind must be office or telehealth." }, { status: 400 });
      }
      patch.kind = body.kind as LocationKind;
    }
    if ("address" in body) {
      patch.address = typeof body.address === "string" && body.address.trim() ? body.address.trim() : null;
    }
    const location = await updateLocation(id, patch);
    if (!location) return NextResponse.json({ error: "Location not found." }, { status: 404 });
    await logEvent({
      actorId: user.id,
      action: "location.update",
      entity: "location",
      entityId: location.id,
      meta: { name: location.name },
    });
    return NextResponse.json({ location });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not update location." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const ok = await deleteLocation(id);
    if (!ok) return NextResponse.json({ error: "Location not found." }, { status: 404 });
    await logEvent({
      actorId: user.id,
      action: "location.delete",
      entity: "location",
      entityId: id,
      meta: null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not delete location." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole, requireUser } from "@/lib/auth";
import { createLocation, listLocations } from "@/lib/repos/services";
import type { LocationKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS: LocationKind[] = ["office", "telehealth"];

function authResponse(e: unknown): NextResponse | null {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  return null;
}

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ locations: await listLocations() });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not list locations." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("practitioner");
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const kind = typeof body.kind === "string" ? (body.kind as LocationKind) : "office";
    if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });
    if (!KINDS.includes(kind)) {
      return NextResponse.json({ error: "kind must be office or telehealth." }, { status: 400 });
    }
    const location = await createLocation({
      name,
      kind,
      address: typeof body.address === "string" && body.address.trim() ? body.address.trim() : null,
    });
    await logEvent({
      actorId: user.id,
      action: "location.create",
      entity: "location",
      entityId: location.id,
      meta: { name: location.name },
    });
    return NextResponse.json({ location }, { status: 201 });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not create location." }, { status: 500 });
  }
}

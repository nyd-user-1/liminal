import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole, requireUser } from "@/lib/auth";
import { createService, listServices } from "@/lib/repos/services";
import { SERVICE_COLOR_SLOTS } from "@/lib/service-colors";

export const dynamic = "force-dynamic";

const COLOR_NAMES = SERVICE_COLOR_SLOTS.map((s) => s.name as string);

function authResponse(e: unknown): NextResponse | null {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  return null;
}

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ services: await listServices() });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not list services." }, { status: 500 });
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
    const durationMin = typeof body.durationMin === "number" ? body.durationMin : NaN;
    const priceCents = typeof body.priceCents === "number" ? body.priceCents : NaN;
    const color = typeof body.color === "string" ? body.color : "";
    if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });
    if (!Number.isInteger(durationMin) || durationMin < 5) {
      return NextResponse.json({ error: "durationMin must be an integer ≥ 5." }, { status: 400 });
    }
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: "priceCents must be a non-negative integer." }, { status: 400 });
    }
    if (!COLOR_NAMES.includes(color)) {
      return NextResponse.json({ error: "color must be one of the service color slots." }, { status: 400 });
    }
    const service = await createService({
      name,
      durationMin,
      priceCents,
      color,
      telehealth: body.telehealth === true,
      active: body.active !== false,
    });
    await logEvent({
      actorId: user.id,
      action: "service.create",
      entity: "service",
      entityId: service.id,
      meta: { name: service.name },
    });
    return NextResponse.json({ service }, { status: 201 });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not create service." }, { status: 500 });
  }
}

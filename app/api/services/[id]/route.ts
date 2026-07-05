import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { deleteService, updateService, type CreateServiceInput } from "@/lib/repos/services";
import { SERVICE_COLOR_SLOTS } from "@/lib/service-colors";

export const dynamic = "force-dynamic";

const COLOR_NAMES = SERVICE_COLOR_SLOTS.map((s) => s.name as string);

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
    const patch: Partial<CreateServiceInput> = {};
    if ("name" in body) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "name must be a non-empty string." }, { status: 400 });
      }
      patch.name = body.name.trim();
    }
    if ("durationMin" in body) {
      if (typeof body.durationMin !== "number" || !Number.isInteger(body.durationMin) || body.durationMin < 5) {
        return NextResponse.json({ error: "durationMin must be an integer ≥ 5." }, { status: 400 });
      }
      patch.durationMin = body.durationMin;
    }
    if ("priceCents" in body) {
      if (typeof body.priceCents !== "number" || !Number.isInteger(body.priceCents) || body.priceCents < 0) {
        return NextResponse.json({ error: "priceCents must be a non-negative integer." }, { status: 400 });
      }
      patch.priceCents = body.priceCents;
    }
    if ("color" in body) {
      if (typeof body.color !== "string" || !COLOR_NAMES.includes(body.color)) {
        return NextResponse.json({ error: "color must be one of the service color slots." }, { status: 400 });
      }
      patch.color = body.color;
    }
    if ("telehealth" in body) patch.telehealth = body.telehealth === true;
    if ("active" in body) patch.active = body.active === true;

    const service = await updateService(id, patch);
    if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });
    await logEvent({
      actorId: user.id,
      action: "service.update",
      entity: "service",
      entityId: service.id,
      meta: { name: service.name, active: service.active },
    });
    return NextResponse.json({ service });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not update service." }, { status: 500 });
  }
}

/** DELETE = deactivate (appointments keep their service history). */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const ok = await deleteService(id);
    if (!ok) return NextResponse.json({ error: "Service not found." }, { status: 404 });
    await logEvent({
      actorId: user.id,
      action: "service.deactivate",
      entity: "service",
      entityId: id,
      meta: null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not deactivate service." }, { status: 500 });
  }
}

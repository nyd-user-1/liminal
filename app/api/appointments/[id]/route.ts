import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import {
  getAppointment,
  updateAppointment,
  type UpdateAppointmentPatch,
} from "@/lib/repos/appointments";
import type { AppointmentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "arrived",
  "completed",
  "cancelled",
  "no_show",
];

type Params = { params: Promise<{ id: string }> };

function authResponse(e: unknown): NextResponse | null {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  return null;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireRole("practitioner");
    const { id } = await params;
    const appointment = await getAppointment(id);
    if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    return NextResponse.json({ appointment });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not load appointment." }, { status: 500 });
  }
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

    const patch: UpdateAppointmentPatch = {};
    const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : undefined);
    patch.clientId = str("clientId");
    patch.practitionerId = str("practitionerId");
    patch.serviceId = str("serviceId");
    patch.startsAt = str("startsAt");
    patch.endsAt = str("endsAt");
    if ("locationId" in body) patch.locationId = str("locationId") ?? null;
    if ("notesBrief" in body) patch.notesBrief = str("notesBrief") ?? null;
    if ("cancelledReason" in body) patch.cancelledReason = str("cancelledReason") ?? null;
    const status = str("status");
    if (status !== undefined) {
      if (!STATUSES.includes(status as AppointmentStatus)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      patch.status = status as AppointmentStatus;
    }
    if (patch.startsAt && patch.endsAt && new Date(patch.startsAt) >= new Date(patch.endsAt)) {
      return NextResponse.json({ error: "endsAt must be after startsAt." }, { status: 400 });
    }

    const appointment = await updateAppointment(id, patch);
    if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

    await logEvent({
      actorId: user.id,
      action: patch.status === "cancelled" ? "appointment.cancel" : "appointment.update",
      entity: "appointment",
      entityId: appointment.id,
      meta: { status: appointment.status, startsAt: appointment.startsAt },
    });
    return NextResponse.json({ appointment });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not update appointment." }, { status: 500 });
  }
}

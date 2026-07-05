import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { createAppointment, listAppointments } from "@/lib/repos/appointments";
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

function authResponse(e: unknown): NextResponse | null {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  return null;
}

export async function GET(req: Request) {
  try {
    await requireRole("practitioner");
    const p = new URL(req.url).searchParams;
    const status = p.get("status");
    if (status && !STATUSES.includes(status as AppointmentStatus)) {
      return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
    }
    const appointments = await listAppointments({
      clientId: p.get("clientId") ?? undefined,
      practitionerId: p.get("practitionerId") ?? undefined,
      from: p.get("from") ?? undefined,
      to: p.get("to") ?? undefined,
      status: (status as AppointmentStatus) ?? undefined,
    });
    return NextResponse.json({ appointments });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not list appointments." }, { status: 500 });
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
    const required = ["clientId", "practitionerId", "serviceId", "startsAt", "endsAt"] as const;
    for (const k of required) {
      if (typeof body[k] !== "string" || !body[k]) {
        return NextResponse.json({ error: `${k} is required.` }, { status: 400 });
      }
    }
    if (new Date(body.startsAt as string) >= new Date(body.endsAt as string)) {
      return NextResponse.json({ error: "endsAt must be after startsAt." }, { status: 400 });
    }
    const appointment = await createAppointment({
      clientId: body.clientId as string,
      practitionerId: body.practitionerId as string,
      serviceId: body.serviceId as string,
      locationId: typeof body.locationId === "string" ? body.locationId : null,
      startsAt: body.startsAt as string,
      endsAt: body.endsAt as string,
      notesBrief: typeof body.notesBrief === "string" ? body.notesBrief : null,
      bookedVia: "staff",
    });
    await logEvent({
      actorId: user.id,
      action: "appointment.create",
      entity: "appointment",
      entityId: appointment.id,
      meta: { serviceId: appointment.serviceId, startsAt: appointment.startsAt },
    });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not create appointment." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { DATE_RE, TIME_RE, freeSlots, localDate, toMin } from "@/lib/booking";
import { sendBookingConfirmation } from "@/lib/email";
import { getAppointment, updateAppointment } from "@/lib/repos/appointments";
import { authorNames } from "@/lib/repos/notes";
import { getService, listLocations } from "@/lib/repos/services";
import { clientForUser } from "@/lib/repos/threads";

export const dynamic = "force-dynamic";

// Portal self-service on the client's own appointment.
// PATCH { action: "cancel" } | { action: "reschedule", date, time }
// Only upcoming scheduled/confirmed appointments; reschedules re-validate the
// slot against live availability (ignoring the appointment itself).

function fail(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("client");
    const { id } = await params;
    const client = await clientForUser(user.id);
    const appointment = await getAppointment(id);
    if (!client || !appointment || appointment.clientId !== client.id) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (appointment.status !== "scheduled" && appointment.status !== "confirmed") {
      return NextResponse.json({ error: "This appointment can no longer be changed." }, { status: 400 });
    }
    if (new Date(appointment.startsAt) <= new Date()) {
      return NextResponse.json({ error: "This appointment has already started." }, { status: 400 });
    }

    const body = (await req.json()) as { action?: string; date?: string; time?: string };

    if (body.action === "cancel") {
      const updated = await updateAppointment(id, {
        status: "cancelled",
        cancelledReason: "Cancelled by client via portal",
      });
      await logEvent({ actorId: user.id, action: "appointment.cancel", entity: "appointment", entityId: id, meta: { via: "portal" } });
      return NextResponse.json(updated);
    }

    if (body.action === "reschedule") {
      const { date, time } = body;
      if (!date || !time || !DATE_RE.test(date) || !TIME_RE.test(time)) {
        return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
      }
      const service = await getService(appointment.serviceId);
      if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });

      const slots = await freeSlots(appointment.practitionerId, service, date, { ignoreAppointmentId: id });
      if (!slots.includes(time)) {
        return NextResponse.json({ error: "That time was just taken — please pick another slot." }, { status: 409 });
      }

      const startMin = toMin(time);
      const updated = await updateAppointment(id, {
        startsAt: localDate(date, startMin).toISOString(),
        endsAt: localDate(date, startMin + service.durationMin).toISOString(),
        status: "scheduled",
      });
      await logEvent({ actorId: user.id, action: "appointment.reschedule", entity: "appointment", entityId: id, meta: { via: "portal", startsAt: updated?.startsAt } });

      if (updated && client.email) {
        const names = await authorNames([appointment.practitionerId]);
        const locations = await listLocations();
        const location = appointment.locationId ? locations.find((l) => l.id === appointment.locationId) : null;
        await sendBookingConfirmation({
          to: client.email,
          firstName: client.firstName,
          serviceName: service.name,
          practitionerName: names[appointment.practitionerId] ?? "your practitioner",
          startsAt: updated.startsAt,
          endsAt: updated.endsAt,
          locationLabel: location?.name ?? null,
          telehealth: !!appointment.videoRoom || service.telehealth,
        });
      }
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}

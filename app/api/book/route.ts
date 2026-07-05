import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import {
  createAppointment,
  findOrCreateLeadClient,
  listAppointments,
} from "@/lib/repos/appointments";
import { getService, listAvailability, listLocations } from "@/lib/repos/services";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public booking endpoint (no auth — the /book/[slug] page).
// GET  ?practitionerId&serviceId&date=YYYY-MM-DD → { slots: ["09:00", …] }
//      free start times from weekly availability minus existing appointments.
// POST { practitionerId, serviceId, date, time, firstName, lastName, email, phone? }
//      → creates client-if-new (status lead) + appointment (booked_via link).

const SLOT_STEP_MIN = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Local-time Date for a plain date + minutes-of-day (practice timezone = server local). */
const localDate = (date: string, min: number) => new Date(`${date}T${toHHMM(min)}:00`);

async function freeSlots(practitionerId: string, service: Service, date: string): Promise<string[]> {
  const weekday = localDate(date, 0).getDay();
  const rules = (await listAvailability(practitionerId)).filter((r) => r.weekday === weekday);
  if (rules.length === 0) return [];

  const dayStart = localDate(date, 0);
  const dayEnd = localDate(date, 24 * 60);
  const busy = (await listAppointments({
    practitionerId,
    from: dayStart.toISOString(),
    to: dayEnd.toISOString(),
  })).filter((a) => a.status !== "cancelled");

  const now = new Date();
  const slots: string[] = [];
  for (const rule of rules) {
    const windowStart = toMin(rule.startTime);
    const windowEnd = toMin(rule.endTime);
    for (let start = windowStart; start + service.durationMin <= windowEnd; start += SLOT_STEP_MIN) {
      const s = localDate(date, start);
      const e = localDate(date, start + service.durationMin);
      if (s <= now) continue;
      const clash = busy.some((a) => s < new Date(a.endsAt) && e > new Date(a.startsAt));
      if (!clash) slots.push(toHHMM(start));
    }
  }
  return [...new Set(slots)].sort();
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const practitionerId = p.get("practitionerId") ?? "";
  const serviceId = p.get("serviceId") ?? "";
  const date = p.get("date") ?? "";
  if (!practitionerId || !serviceId || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "practitionerId, serviceId and date are required." }, { status: 400 });
  }
  const service = await getService(serviceId);
  if (!service || !service.active) return NextResponse.json({ error: "Service not found." }, { status: 404 });
  try {
    return NextResponse.json({ slots: await freeSlots(practitionerId, service, date) });
  } catch {
    return NextResponse.json({ error: "Could not load availability." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const practitionerId = s("practitionerId");
  const serviceId = s("serviceId");
  const date = s("date");
  const time = s("time");
  const firstName = s("firstName");
  const lastName = s("lastName");
  const email = s("email").toLowerCase();
  const phone = s("phone");

  if (!practitionerId || !serviceId) {
    return NextResponse.json({ error: "Pick a service." }, { status: 400 });
  }
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) {
    return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
  }
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Your first and last name are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const service = await getService(serviceId);
  if (!service || !service.active) return NextResponse.json({ error: "Service not found." }, { status: 404 });

  try {
    // The slot must still be free (someone may have booked it meanwhile).
    const slots = await freeSlots(practitionerId, service, date);
    if (!slots.includes(time)) {
      return NextResponse.json({ error: "That time was just taken — please pick another slot." }, { status: 409 });
    }

    const { client, created } = await findOrCreateLeadClient({
      firstName,
      lastName,
      email,
      phone: phone || null,
      practitionerId,
    });
    if (created) {
      await logEvent({
        actorId: null,
        action: "client.create",
        entity: "client",
        entityId: client.id,
        meta: { via: "booking-link" },
      });
    }

    const startMin = toMin(time);
    const locations = await listLocations();
    const location =
      locations.find((l) => (service.telehealth ? l.kind === "telehealth" : l.kind === "office")) ??
      locations[0] ?? null;

    const appointment = await createAppointment({
      clientId: client.id,
      practitionerId,
      serviceId,
      locationId: location?.id ?? null,
      startsAt: localDate(date, startMin).toISOString(),
      endsAt: localDate(date, startMin + service.durationMin).toISOString(),
      bookedVia: "link",
      notesBrief: "Booked via public booking link",
    });
    await logEvent({
      actorId: null,
      action: "appointment.book",
      entity: "appointment",
      entityId: appointment.id,
      meta: { via: "booking-link", serviceId, startsAt: appointment.startsAt },
    });

    return NextResponse.json({ ok: true, appointment: { id: appointment.id, startsAt: appointment.startsAt, endsAt: appointment.endsAt } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not complete your booking. Please try again." }, { status: 500 });
  }
}

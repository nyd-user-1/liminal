import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { createSession, findOrCreatePortalUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import {
  createAppointment,
  findOrCreateLeadClient,
  listAppointments,
  type ClientLite,
} from "@/lib/repos/appointments";
import { linkClientUser } from "@/lib/repos/clients";
import { getIntakeForm, listResponses, sendForm } from "@/lib/repos/forms";
import { createPolicy } from "@/lib/repos/policies";
import { getService, listAvailability, listLocations } from "@/lib/repos/services";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public booking endpoint (no auth — the /book/[slug] page).
// GET  ?practitionerId&serviceId&date=YYYY-MM-DD → { slots: ["09:00", …] }
//      free start times from weekly availability minus existing appointments.
// POST { practitionerId, serviceId, date, time, firstName, lastName, email, phone?, payerId? }
//      → creates client-if-new (status lead) + appointment (booked_via link),
//      then onboards them: insurance policy if payerId given, a portal
//      account + emailed activation link if they don't have one yet, and the
//      New Client Intake form. None of these three can fail the booking
//      itself — a booking that succeeds but couldn't send an email is still
//      a booking; each is independently best-effort.

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

/**
 * Everything a first-time booking should kick off besides the appointment
 * itself. Each step is independently best-effort — a failure here is logged
 * to the server console and swallowed, never surfaced to the booking response.
 */
async function onboardClient(opts: {
  origin: string;
  client: ClientLite;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  payerId: string;
}): Promise<void> {
  const { client } = opts;

  if (opts.payerId) {
    try {
      await createPolicy({ clientId: client.id, payerId: opts.payerId, memberId: "", kind: "primary", status: "unverified" });
    } catch (e) {
      console.error("onboardClient: insurance policy failed", e);
    }
  }

  if (!client.userId) {
    try {
      const { user, created } = await findOrCreatePortalUser({
        name: `${opts.firstName} ${opts.lastName}`,
        email: opts.email,
        phone: opts.phone || null,
      });
      await linkClientUser(client.id, user.id);
      const { token } = await createSession(user.id);
      await logEvent({
        actorId: null,
        action: created ? "user.create" : "user.link",
        entity: "user",
        entityId: user.id,
        meta: { via: "booking-portal-provision", clientId: client.id },
      });
      await sendEmail({
        to: opts.email,
        subject: "Your Liminal client portal is ready",
        html: `<p>Hi ${opts.firstName},</p>
<p>Your appointment is booked. We've also set up your Liminal client portal — from there you can message your care team, see upcoming appointments, and complete any forms sent to you.</p>
<p><a href="${opts.origin}/portal/activate?token=${token}">Activate your portal</a></p>
<p>— Liminal Psychiatry</p>`,
      });
    } catch (e) {
      console.error("onboardClient: portal provisioning failed", e);
    }
  }

  try {
    const intake = await getIntakeForm();
    if (intake) {
      const already = await listResponses({ clientId: client.id, formId: intake.id });
      if (already.length === 0) await sendForm(intake.id, client.id);
    }
  } catch (e) {
    console.error("onboardClient: intake form send failed", e);
  }
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
  const payerId = s("payerId"); // "" = self-pay/cash, no policy created

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

    await onboardClient({
      origin: new URL(req.url).origin,
      client,
      firstName,
      lastName,
      email,
      phone,
      payerId,
    });

    return NextResponse.json({ ok: true, appointment: { id: appointment.id, startsAt: appointment.startsAt, endsAt: appointment.endsAt } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not complete your booking. Please try again." }, { status: 500 });
  }
}

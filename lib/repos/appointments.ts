import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";
import { mockId, mockStore } from "@/lib/mock";
import "@/lib/mock/appointments";
import { getService } from "@/lib/repos/services";
import type { Appointment, AppointmentStatus, BookedVia, Client } from "@/lib/types";

// Appointments repo — the scheduling contract other agents build against:
//   listAppointments(f?) · getAppointment(id) · createAppointment(input) ·
//   updateAppointment(id, patch)   (status changes incl. cancel)
// hasDb → Postgres; otherwise the in-memory mock store.

type AppointmentRow = {
  id: string;
  client_id: string;
  practitioner_id: string;
  service_id: string;
  location_id: string | null;
  starts_at: string | Date;
  ends_at: string | Date;
  status: AppointmentStatus;
  video_room: string | null;
  booked_via: BookedVia;
  notes_brief: string | null;
  cancelled_reason: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toAppointment(r: AppointmentRow): Appointment {
  return {
    id: r.id,
    clientId: r.client_id,
    practitionerId: r.practitioner_id,
    serviceId: r.service_id,
    locationId: r.location_id,
    startsAt: isoDateTime(r.starts_at),
    endsAt: isoDateTime(r.ends_at),
    status: r.status,
    videoRoom: r.video_room,
    bookedVia: r.booked_via,
    notesBrief: r.notes_brief,
    cancelledReason: r.cancelled_reason,
    createdAt: isoDateTime(r.created_at),
    updatedAt: isoDateTime(r.updated_at),
  };
}

export interface AppointmentFilter {
  clientId?: string;
  practitionerId?: string;
  from?: string; // ISO — overlap window start
  to?: string; // ISO — overlap window end
  status?: AppointmentStatus;
}

export async function listAppointments(f?: AppointmentFilter): Promise<Appointment[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT * FROM appointments
      WHERE (${f?.clientId ?? null}::uuid IS NULL OR client_id = ${f?.clientId ?? null})
        AND (${f?.practitionerId ?? null}::uuid IS NULL OR practitioner_id = ${f?.practitionerId ?? null})
        AND (${f?.status ?? null}::text IS NULL OR status = ${f?.status ?? null})
        AND (${f?.from ?? null}::timestamptz IS NULL OR ends_at > ${f?.from ?? null})
        AND (${f?.to ?? null}::timestamptz IS NULL OR starts_at < ${f?.to ?? null})
      ORDER BY starts_at
    `) as AppointmentRow[];
    return rows.map(toAppointment);
  }
  return [...mockStore().appointments.values()]
    .filter(
      (a) =>
        (!f?.clientId || a.clientId === f.clientId) &&
        (!f?.practitionerId || a.practitionerId === f.practitionerId) &&
        (!f?.status || a.status === f.status) &&
        (!f?.from || new Date(a.endsAt) > new Date(f.from)) &&
        (!f?.to || new Date(a.startsAt) < new Date(f.to)),
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM appointments WHERE id = ${id}`) as AppointmentRow[];
    return rows[0] ? toAppointment(rows[0]) : null;
  }
  return mockStore().appointments.get(id) ?? null;
}

export interface CreateAppointmentInput {
  clientId: string;
  practitionerId: string;
  serviceId: string;
  locationId?: string | null;
  startsAt: string; // ISO
  endsAt: string; // ISO
  status?: AppointmentStatus;
  bookedVia?: BookedVia;
  notesBrief?: string | null;
  videoRoom?: string | null;
}

export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  // Telehealth services get a video room automatically (lim-xxxxxx).
  let videoRoom = input.videoRoom ?? null;
  if (!videoRoom) {
    const service = await getService(input.serviceId);
    if (service?.telehealth) videoRoom = `lim-${Math.random().toString(36).slice(2, 8)}`;
  }
  const status = input.status ?? "scheduled";
  const bookedVia = input.bookedVia ?? "staff";
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO appointments
        (client_id, practitioner_id, service_id, location_id, starts_at, ends_at,
         status, video_room, booked_via, notes_brief)
      VALUES
        (${input.clientId}, ${input.practitionerId}, ${input.serviceId}, ${input.locationId ?? null},
         ${input.startsAt}, ${input.endsAt}, ${status}, ${videoRoom}, ${bookedVia}, ${input.notesBrief ?? null})
      RETURNING *
    `) as AppointmentRow[];
    return toAppointment(rows[0]);
  }
  const now = new Date().toISOString();
  const apt: Appointment = {
    id: mockId(),
    clientId: input.clientId,
    practitionerId: input.practitionerId,
    serviceId: input.serviceId,
    locationId: input.locationId ?? null,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status,
    videoRoom,
    bookedVia,
    notesBrief: input.notesBrief ?? null,
    cancelledReason: null,
    createdAt: now,
    updatedAt: now,
  };
  mockStore().appointments.set(apt.id, apt);
  return apt;
}

export interface UpdateAppointmentPatch {
  clientId?: string;
  practitionerId?: string;
  serviceId?: string;
  locationId?: string | null;
  startsAt?: string;
  endsAt?: string;
  status?: AppointmentStatus; // incl. "cancelled"
  notesBrief?: string | null;
  cancelledReason?: string | null;
}

export async function updateAppointment(
  id: string,
  patch: UpdateAppointmentPatch,
): Promise<Appointment | null> {
  const existing = await getAppointment(id);
  if (!existing) return null;
  const next: Appointment = {
    ...existing,
    clientId: patch.clientId ?? existing.clientId,
    practitionerId: patch.practitionerId ?? existing.practitionerId,
    serviceId: patch.serviceId ?? existing.serviceId,
    locationId: patch.locationId === undefined ? existing.locationId : patch.locationId,
    startsAt: patch.startsAt ?? existing.startsAt,
    endsAt: patch.endsAt ?? existing.endsAt,
    status: patch.status ?? existing.status,
    notesBrief: patch.notesBrief === undefined ? existing.notesBrief : patch.notesBrief,
    cancelledReason:
      patch.cancelledReason === undefined ? existing.cancelledReason : patch.cancelledReason,
    updatedAt: new Date().toISOString(),
  };
  if (hasDb) {
    const rows = (await sql`
      UPDATE appointments SET
        client_id = ${next.clientId}, practitioner_id = ${next.practitionerId},
        service_id = ${next.serviceId}, location_id = ${next.locationId},
        starts_at = ${next.startsAt}, ends_at = ${next.endsAt}, status = ${next.status},
        notes_brief = ${next.notesBrief}, cancelled_reason = ${next.cancelledReason},
        updated_at = now()
      WHERE id = ${id} RETURNING *
    `) as AppointmentRow[];
    return rows[0] ? toAppointment(rows[0]) : null;
  }
  mockStore().appointments.set(id, next);
  return next;
}

// ── scheduling-local client helpers ───────────────────────────────────────────
// (The clients domain is owned by another agent; these are the minimal reads/
// writes scheduling needs — a picker list and lead capture from public booking.)

export interface ClientLite {
  id: string;
  name: string;
  status: Client["status"];
}

export async function listClientsLite(): Promise<ClientLite[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT id, first_name, last_name, status FROM clients ORDER BY first_name, last_name
    `) as Array<{ id: string; first_name: string; last_name: string; status: Client["status"] }>;
    return rows.map((r) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`, status: r.status }));
  }
  return [...mockStore().clients.values()]
    .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, status: c.status }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Public booking: match an existing client by email, or create a lead. */
export async function findOrCreateLeadClient(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  practitionerId: string;
}): Promise<{ client: ClientLite; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  if (hasDb) {
    const found = (await sql`
      SELECT id, first_name, last_name, status FROM clients WHERE lower(email) = ${email} LIMIT 1
    `) as Array<{ id: string; first_name: string; last_name: string; status: Client["status"] }>;
    if (found[0]) {
      const r = found[0];
      return { client: { id: r.id, name: `${r.first_name} ${r.last_name}`, status: r.status }, created: false };
    }
    const rows = (await sql`
      INSERT INTO clients (first_name, last_name, email, phone, status, tags, primary_practitioner_id)
      VALUES (${input.firstName}, ${input.lastName}, ${email}, ${input.phone ?? null},
              'lead', ${["online-booking"]}, ${input.practitionerId})
      RETURNING id, first_name, last_name, status
    `) as Array<{ id: string; first_name: string; last_name: string; status: Client["status"] }>;
    const r = rows[0];
    return { client: { id: r.id, name: `${r.first_name} ${r.last_name}`, status: r.status }, created: true };
  }
  const store = mockStore();
  const existing = [...store.clients.values()].find((c) => c.email?.toLowerCase() === email);
  if (existing) {
    return {
      client: { id: existing.id, name: `${existing.firstName} ${existing.lastName}`, status: existing.status },
      created: false,
    };
  }
  const now = new Date().toISOString();
  const client: Client = {
    id: mockId(),
    userId: null,
    firstName: input.firstName,
    lastName: input.lastName,
    dob: null,
    email,
    phone: input.phone ?? null,
    address: null,
    gender: null,
    pronouns: null,
    status: "lead",
    tags: ["online-booking"],
    primaryPractitionerId: input.practitionerId,
    createdAt: now,
    updatedAt: now,
  };
  store.clients.set(client.id, client);
  return { client: { id: client.id, name: `${client.firstName} ${client.lastName}`, status: client.status }, created: true };
}

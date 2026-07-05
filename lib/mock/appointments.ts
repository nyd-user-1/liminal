import { DEMO_PRACTITIONER_ID, registerFixtures } from "@/lib/mock";
// Dependencies: services/locations/availability + clients must be in the store
// before appointments referencing them make sense.
import "@/lib/mock/services";
import "@/lib/mock/clients";
import { PRIYA_PRACTITIONER_ID } from "@/lib/mock/services";
import type { Appointment, AppointmentStatus, BookedVia } from "@/lib/types";

// Mirrors sql/002_seed.sql — appointments (06): 25 rows, 2026-06-22 → 2026-07-17
// (America/New_York, -04). Seed practitioner 00…1001 (Brendan) maps to the mock
// demo login DEMO_PRACTITIONER_ID; Priya keeps her seed uuid.

const B = DEMO_PRACTITIONER_ID;
const P = PRIYA_PRACTITIONER_ID;

const client = (nn: string) => `00000000-0000-4000-8000-0000000020${nn}`;
const service = (n: number) => `00000000-0000-4000-8000-00000000300${n}`;
const OFFICE = "00000000-0000-4000-8000-000000004001";
const TELE = "00000000-0000-4000-8000-000000004002";

const T = "2026-06-01T09:00:00-04:00";

function row(
  nn: string,
  clientNN: string,
  practitionerId: string,
  serviceN: number,
  locationId: string,
  date: string, // YYYY-MM-DD
  start: string, // HH:MM
  end: string, // HH:MM
  status: AppointmentStatus,
  videoRoom: string | null,
  bookedVia: BookedVia,
  notesBrief: string | null = null,
  cancelledReason: string | null = null,
): Appointment {
  return {
    id: `00000000-0000-4000-8000-0000000060${nn}`,
    clientId: client(clientNN),
    practitionerId,
    serviceId: service(serviceN),
    locationId,
    startsAt: `${date}T${start}:00-04:00`,
    endsAt: `${date}T${end}:00-04:00`,
    status,
    videoRoom,
    bookedVia,
    notesBrief,
    cancelledReason,
    createdAt: T,
    updatedAt: T,
  };
}

const appointments: Appointment[] = [
  // two weeks ago (completed)
  row("01", "02", B, 2, OFFICE, "2026-06-22", "09:00", "09:30", "completed", null, "staff", "Med check — stimulant response"),
  row("02", "03", P, 3, OFFICE, "2026-06-22", "10:00", "10:45", "completed", null, "staff"),
  row("03", "01", B, 4, TELE, "2026-06-23", "11:00", "11:20", "completed", "lim-ac01", "portal", "Check-in re: sertraline titration"),
  row("04", "09", P, 1, OFFICE, "2026-06-24", "14:00", "15:00", "no_show", null, "link", "New patient — referral from Dr. Feld"),
  row("05", "05", P, 2, OFFICE, "2026-06-25", "09:30", "10:00", "completed", null, "staff"),
  row("06", "06", P, 5, OFFICE, "2026-06-26", "13:00", "14:30", "completed", null, "staff", "Insomnia skills group, week 4"),
  // Mon Jun 29 – Fri Jul 3
  row("07", "04", B, 3, OFFICE, "2026-06-29", "09:00", "09:45", "completed", null, "staff"),
  row("08", "06", P, 2, OFFICE, "2026-06-29", "10:00", "10:30", "completed", null, "staff"),
  row("09", "01", B, 2, OFFICE, "2026-06-30", "11:00", "11:30", "completed", null, "portal"),
  row("10", "07", P, 3, OFFICE, "2026-06-30", "15:00", "15:45", "completed", null, "staff"),
  row("11", "08", B, 4, TELE, "2026-07-01", "09:00", "09:20", "completed", "lim-ac02", "portal", "Recorded with consent — scribe demo"),
  row("12", "10", P, 1, OFFICE, "2026-07-01", "13:00", "14:00", "cancelled", null, "link", null, "Client requested reschedule"),
  row("13", "02", B, 3, OFFICE, "2026-07-02", "10:00", "10:45", "completed", null, "staff"),
  row("14", "05", P, 4, TELE, "2026-07-02", "14:00", "14:20", "completed", "lim-ac03", "staff"),
  row("15", "03", B, 2, OFFICE, "2026-07-03", "09:30", "10:00", "completed", null, "staff"),
  row("16", "04", P, 2, OFFICE, "2026-07-03", "11:00", "11:30", "cancelled", null, "staff", null, "Practice closed early for holiday weekend"),
  // next week, Jul 6-10 (upcoming)
  row("17", "01", B, 3, OFFICE, "2026-07-06", "09:00", "09:45", "confirmed", null, "portal"),
  row("18", "09", P, 1, OFFICE, "2026-07-06", "11:00", "12:00", "confirmed", null, "link", "Rescheduled after 6/24 no-show"),
  row("19", "06", B, 2, OFFICE, "2026-07-07", "10:00", "10:30", "confirmed", null, "staff"),
  row("20", "07", B, 4, TELE, "2026-07-08", "14:00", "14:20", "scheduled", "lim-ac04", "portal"),
  row("21", "08", P, 3, OFFICE, "2026-07-09", "09:00", "09:45", "scheduled", null, "staff"),
  row("22", "05", P, 5, OFFICE, "2026-07-10", "13:00", "14:30", "scheduled", null, "staff", "Insomnia skills group, week 6"),
  // week after, Jul 13-17
  row("23", "10", P, 1, OFFICE, "2026-07-13", "10:00", "11:00", "scheduled", null, "link"),
  row("24", "01", B, 4, TELE, "2026-07-15", "11:00", "11:20", "scheduled", "lim-ac05", "portal"),
  row("25", "02", B, 2, OFFICE, "2026-07-17", "09:00", "09:30", "scheduled", null, "staff"),
];

registerFixtures("appointments", (store) => {
  for (const a of appointments) store.appointments.set(a.id, a);
});

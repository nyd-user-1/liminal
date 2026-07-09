import { listAppointments } from "@/lib/repos/appointments";
import { listAvailability } from "@/lib/repos/services";
import type { Service } from "@/lib/types";

// Self-booking slot engine, shared by the public /api/book endpoint and the
// portal reschedule flow: free start times = weekly availability windows minus
// existing (non-cancelled) appointments, stepped every SLOT_STEP_MIN.

export const SLOT_STEP_MIN = 30;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Local-time Date for a plain date + minutes-of-day (practice timezone = server local). */
export const localDate = (date: string, min: number) => new Date(`${date}T${toHHMM(min)}:00`);

export async function freeSlots(
  practitionerId: string,
  service: Service,
  date: string,
  opts?: { ignoreAppointmentId?: string },
): Promise<string[]> {
  const weekday = localDate(date, 0).getDay();
  const rules = (await listAvailability(practitionerId)).filter((r) => r.weekday === weekday);
  if (rules.length === 0) return [];

  const dayStart = localDate(date, 0);
  const dayEnd = localDate(date, 24 * 60);
  const busy = (await listAppointments({
    practitionerId,
    from: dayStart.toISOString(),
    to: dayEnd.toISOString(),
  })).filter((a) => a.status !== "cancelled" && a.id !== opts?.ignoreAppointmentId);

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

// Local-date helpers for the calendar surfaces. All "date keys" are
// YYYY-MM-DD strings in the browser's local timezone (the practice timezone).

export const DAY_START_MIN = 7 * 60; // grid renders 7 AM …
export const DAY_END_MIN = 20 * 60; // … to 8 PM
export const PX_PER_MIN = 0.8; // 48px per hour
export const SNAP_MIN = 15;

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Sunday-start week (matches the mini-month DatePicker). */
export function startOfWeek(key: string): string {
  return addDays(key, -parseKey(key).getDay());
}

/** Shift by whole months, clamping the day to the target month's length. */
export function addMonths(key: string, n: number): string {
  const d = parseKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const daysIn = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), daysIn));
  return dateKey(target);
}

/** The days in `key`'s calendar month (1st … last). */
export function daysOfMonth(key: string): string[] {
  const d = parseKey(key);
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => dateKey(new Date(d.getFullYear(), d.getMonth(), i + 1)));
}

/** Full 6-week (42-day) Sunday-start grid covering `key`'s month. */
export function monthMatrix(key: string): string[] {
  const d = parseKey(key);
  const first = dateKey(new Date(d.getFullYear(), d.getMonth(), 1));
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function monthOf(key: string): number {
  return parseKey(key).getMonth();
}

export function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** "6 – 12 Jul 2026" (week) or "Sat 4 Jul 2026" (day). */
export function rangeLabel(days: string[]): string {
  const first = parseKey(days[0]);
  const last = parseKey(days[days.length - 1]);
  const monthYear = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  if (days.length === 1) {
    return first.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} – ${last.getDate()} ${monthYear(first)}`;
  }
  return `${first.getDate()} ${first.toLocaleDateString("en-US", { month: "short" })} – ${last.getDate()} ${monthYear(last)}`;
}

export function snap(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}

export function clampMin(min: number): number {
  return Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, min));
}

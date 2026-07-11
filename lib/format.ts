// Shared display formatters. All date inputs accept an ISO string or Date.

function toDate(d: string | Date): Date {
  return typeof d === "string" ? new Date(d) : d;
}

/** "Jul 4, 2026" */
export function formatDate(d: string | Date): string {
  return toDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "Friday, July 4, 2026" */
export function formatDateLong(d: string | Date): string {
  return toDate(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** "2:30 PM" */
export function formatTime(d: string | Date): string {
  return toDate(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "Jul 4, 2026 · 2:30 PM" */
export function formatDateTime(d: string | Date): string {
  return `${formatDate(d)} · ${formatTime(d)}`;
}

/** "07/04/2026 2:30 PM" */
export function formatDateTimeNumeric(d: string | Date): string {
  const date = toDate(d);
  const day = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  return `${day} ${formatTime(date)}`;
}

// ── DB row normalizers (repo layer) ───────────────────────────────────────────
// The neon driver returns Postgres date/timestamptz columns as JS Date objects
// while mock-mode rows carry ISO strings. Repos pass every date-ish column
// through these so both modes hand components identical shapes (strings).

/** timestamptz column → full ISO string. Identity on strings / null. */
export function isoDateTime(v: string | Date): string;
export function isoDateTime(v: string | Date | null): string | null;
export function isoDateTime(v: string | Date | null): string | null {
  return v instanceof Date ? v.toISOString() : v;
}

/** Plain `date` column → "YYYY-MM-DD" (local calendar parts — no TZ day shift). */
export function isoDateOnly(v: string | Date): string;
export function isoDateOnly(v: string | Date | null): string | null;
export function isoDateOnly(v: string | Date | null): string | null {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return v ? v.slice(0, 10) : v;
}

/** 12500 → "$125.00" */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "OAKDALE" / "1200 MONTAUK HWY" → "Oakdale" / "1200 Montauk Hwy" — directory address/city columns come out of NPPES all-caps. */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bMhotrs\b/i, "MHOTRS");
}

/** "Casey Morgan" → "CM" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

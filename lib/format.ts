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

/** 12500 → "$125.00" */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "Casey Morgan" → "CM" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

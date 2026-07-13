import { titleCase } from "@/lib/format";

// Shared name-flip helper for rate-signal screens — NPPES/MMIS individual
// names arrive "LAST Given…"; flip to reading order. When the given-name
// field holds multiple tokens, the goes-by name is the FINAL token, not the
// first (verified against a live record: "HILARIO HENRY JASON" is Jason
// Hilario — Henry is the middle name). Organizations (digits, corporate
// suffixes) pass through untouched.
const ORG_RE = /\d|\b(inc|llc|pllc|pc|corp|co|group|center|services|associates|company|hospital|clinic|health)\b/i;

export function clinicianName(raw: string): string {
  const cased = titleCase(raw.trim());
  if (ORG_RE.test(raw)) return cased;
  const parts = cased.split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return cased;
  const [last, ...given] = parts;
  return `${given[given.length - 1]} ${last}`;
}

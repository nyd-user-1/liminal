// The behavioral CPTs carried by provider_rate_signals (sql/017) — client-safe
// (no repo import: repo modules pull in lib/db). Labels come from the single
// source: the generated map (lib/cpt-labels.generated.ts ← cpt_codes table),
// so wording never forks between here, lib/rate-table.ts and lib/repos/plans.ts.
//
// THREE ROLES, kept separate on purpose:
//   ALL_CPTS   — every code we price (all 20). Anything that FILTERS or LISTS
//                codes iterates this: the Services code facet, the Bands code
//                chip, the Spread remit form. A code we hold and cannot reach
//                from the product is the NYS-50 gap.
//   RATE_CPTS  — the codes a rate table shows as a COLUMN BY DEFAULT. Twenty
//                currency columns is a wall, so the five workhorses lead and
//                the other fifteen arrive through the DataTable column picker
//                — present, named, one click away, never absent.
//   cptLabel   — the NAME of ANY code we might DISPLAY. A bare CPT number is
//                not a label ("90839 · 90839" was the old fallback).
import { CPT_LABELS } from "@/lib/cpt-labels.generated";

/** Every priced code, ascending — the display order for pickers and filters. */
export const ALL_CPTS: Array<{ code: string; label: string }> = Object.keys(CPT_LABELS)
  .sort()
  .map((code) => ({ code, label: CPT_LABELS[code] }));

// The five that lead a rate table. The rest are column-picker entries, not
// absences — see ALL_CPTS above.
const COLUMN_CODES = ["90791", "90834", "90837", "90853", "99214"] as const;

export const RATE_CPTS: Array<{ code: string; label: string }> = COLUMN_CODES.map((code) => ({
  code,
  label: CPT_LABELS[code] ?? code,
}));

/** True for the five that a rate table shows without being asked. */
export const isLeadCode = (code: string): boolean => (COLUMN_CODES as readonly string[]).includes(code);

export const DEFAULT_CODES = ["90834", "90837"];

export function cptLabel(code: string): string {
  return CPT_LABELS[code] ?? code;
}

// The behavioral CPTs carried by provider_rate_signals (sql/017) — client-safe
// (no repo import: repo modules pull in lib/db). Labels come from the single
// source: the generated map (lib/cpt-labels.generated.ts ← cpt_codes table),
// so wording never forks between here, lib/rate-table.ts and lib/repos/plans.ts.
//
// TWO ROLES, kept separate on purpose:
//   RATE_CPTS  — the codes each rate TABLE gives its own COLUMN to (recruiting,
//                spread, bands panels iterate it). Stays the focused five; a
//                sixth here is a sixth column everywhere.
//   cptLabel   — the NAME of ANY code we might DISPLAY. scan-tic emits 20 codes,
//                so a rate row can carry a code with no column of its own; it
//                still needs a human name, not the bare number the fallback used
//                to return ("90839 · 90839"). Hence the label lookup is the FULL
//                set even though the column set is not.
import { CPT_LABELS } from "@/lib/cpt-labels.generated";

// The five codes with a dedicated rate-table column, in table order.
const COLUMN_CODES = ["90791", "90834", "90837", "90853", "99214"] as const;

export const RATE_CPTS: Array<{ code: string; label: string }> = COLUMN_CODES.map((code) => ({
  code,
  label: CPT_LABELS[code] ?? code,
}));

export const DEFAULT_CODES = ["90834", "90837"];

export function cptLabel(code: string): string {
  return CPT_LABELS[code] ?? code;
}

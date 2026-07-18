// The behavioral CPTs carried by provider_rate_signals (sql/017) — client-safe
// constants (no repo import: repo modules pull in lib/db).
//
// TWO ROLES, kept separate on purpose:
//   RATE_CPTS  — the codes each rate TABLE gives its own COLUMN to (recruiting,
//                spread, bands panels iterate it). Widening this widens every
//                one of those tables, so it stays the focused five.
//   cptLabel   — the NAME of ANY code we might DISPLAY. scan-tic's default set
//                widened 5 -> 20 (sql/050), so a rate row can now carry a code
//                with no column of its own; it still needs a human name, not the
//                bare number cptLabel used to fall back to ("90839 · 90839").
//                Hence the label dictionary is the FULL set even though the
//                column set is not.
//
// Both are OUR OWN plain-language wording, mirroring cpt_codes.display_name
// (sql/033 §8 + sql/050) — never AMA descriptor text. cpt_codes is the eventual
// single source; this client-safe copy exists because the repo/DB can't cross
// into the browser bundle. Keep the two in sync when either changes.

export const RATE_CPTS: Array<{ code: string; label: string }> = [
  { code: "90791", label: "Diagnostic evaluation" },
  { code: "90834", label: "Psychotherapy, 45 min" },
  { code: "90837", label: "Psychotherapy, 60 min" },
  { code: "90853", label: "Group psychotherapy" },
  { code: "99214", label: "E/M established, moderate" },
];

export const DEFAULT_CODES = ["90834", "90837"];

// The full label dictionary — the widened scan-tic set. Superset of RATE_CPTS
// (those five seed it below); the extra fifteen are labels-only, no dedicated
// column. Any code absent here still falls through to its bare number.
const CPT_LABELS: Record<string, string> = {
  ...Object.fromEntries(RATE_CPTS.map((c) => [c.code, c.label])),
  "90792": "Diagnostic evaluation, w/ meds",
  "90832": "Psychotherapy, 30 min",
  "90833": "Psychotherapy, 30 min (with E/M)",
  "90836": "Psychotherapy, 45 min (with E/M)",
  "90838": "Psychotherapy, 60 min (with E/M)",
  "90839": "Crisis psychotherapy, 60 min",
  "90840": "Crisis psychotherapy, +30 min",
  "90846": "Family therapy, client absent",
  "90847": "Family therapy, client present",
  "90785": "Communication-complexity add-on",
  "96127": "Brief behavioral screener",
  "99204": "E/M new patient, moderate",
  "99205": "E/M new patient, high",
  "99213": "E/M established, low",
  "99215": "E/M established, high",
};

export function cptLabel(code: string): string {
  return CPT_LABELS[code] ?? code;
}

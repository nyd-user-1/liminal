// The behavioral CPTs carried by provider_rate_signals (sql/017) — client-safe
// constants (no repo import: repo modules pull in lib/db).

export const RATE_CPTS: Array<{ code: string; label: string }> = [
  { code: "90791", label: "Diagnostic evaluation" },
  { code: "90834", label: "Psychotherapy, 45 min" },
  { code: "90837", label: "Psychotherapy, 60 min" },
  { code: "90853", label: "Group psychotherapy" },
  { code: "99214", label: "E/M established, moderate" },
];

export const DEFAULT_CODES = ["90834", "90837"];

export function cptLabel(code: string): string {
  return RATE_CPTS.find((c) => c.code === code)?.label ?? code;
}

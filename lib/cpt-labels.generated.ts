// GENERATED FILE — do not edit by hand.
// Source of truth: the cpt_codes table (sql/033 §8 + sql/050).
// Regenerate:  node --env-file=.env.local scripts/gen-cpt-labels.mjs
//
// The single client-safe CPT label map. Every rendering surface reads it so the
// wording never forks across components/rates/cpt.ts, lib/rate-table.ts and
// lib/repos/plans.ts. NOT AMA descriptor text — our own plain-language wording.

export const CPT_LABELS: Record<string, string> = {
  "90785": "Communication-complexity add-on",
  "90791": "Diagnostic evaluation",
  "90792": "Diagnostic evaluation with medication review",
  "90832": "Psychotherapy 30 min",
  "90833": "Psychotherapy 30 min with medication management",
  "90834": "Psychotherapy 45 min",
  "90836": "Psychotherapy 45 min with medication management",
  "90837": "Psychotherapy 60 min",
  "90838": "Psychotherapy 60 min with medication management",
  "90839": "Crisis psychotherapy (first 60 min)",
  "90840": "Crisis psychotherapy, added 30 min",
  "90846": "Family therapy without the client present",
  "90847": "Family therapy with the client present",
  "90853": "Group psychotherapy",
  "96127": "Brief behavioral screener",
  "99204": "New patient visit (moderate complexity)",
  "99205": "New patient visit (high complexity)",
  "99213": "Established patient visit (low complexity)",
  "99214": "Established patient visit",
  "99215": "Established patient visit (high complexity)",
};

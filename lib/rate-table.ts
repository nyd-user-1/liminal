// Published-rates shared vocabulary — types, the payer allowlist, the five
// codes, TIN masking. Pure: NO database import, so the "use client" table can
// import these values directly. lib/repos/rate-table.ts holds the actual read.
//
// This split is load-bearing, not tidiness: every client component in this
// codebase imports from lib/repos with `import type` only. Importing a VALUE
// from a repo drags lib/db into the browser bundle, where the `sql` Proxy's
// get-trap constructs a Neon client and throws "DATABASE_URL is not set".

export const RATE_TABLE_PAYERS = [
  "Cigna Health & Life",
  "Empire BlueCross BlueShield",
  "Oxford Health Insurance Inc",
  "EmblemHealth (Carelon behavioral)",
  "Fidelis Care (Centene)",
  "MetroPlus Health Plan",
] as const;

export type RateTablePayer = (typeof RATE_TABLE_PAYERS)[number];

export const DEFAULT_RATE_PAYER: RateTablePayer = "Cigna Health & Life";

/** `?payer=` is user input — anything off the allowlist falls back to the default. */
export function resolveRatePayer(v: string | undefined | null): RateTablePayer {
  return RATE_TABLE_PAYERS.includes(v as RateTablePayer) ? (v as RateTablePayer) : DEFAULT_RATE_PAYER;
}

/** The five codes, in table order. `name` is the plain-English header tooltip + legend. */
export const RATE_CODES = [
  { key: "c90791", code: "90791", name: "Diagnostic evaluation" },
  { key: "c90834", code: "90834", name: "Psychotherapy 45 min" },
  { key: "c90837", code: "90837", name: "Psychotherapy 60 min" },
  { key: "c90853", code: "90853", name: "Group psychotherapy" },
  { key: "c99214", code: "99214", name: "Established patient visit" },
] as const;

export interface RateTableRow {
  tin: string;
  /** NULL when no name resolved — the UI renders "Unnamed practice · N clinicians". */
  displayName: string | null;
  entityKind: "individual" | "organization";
  /** Individual-only (raw, unnormalized — what the provider recognizes). */
  credential: string | null;
  /** Individual-only, uppercase + punctuation-stripped — what the filter chips group on. */
  credentialNorm: string | null;
  county: string | null;
  /** Roster NPIs, empty for rosters > 25 (platform TINs). Client-side NPI search. */
  npis: string[];
  nClinicians: number;
  c90791: number | null;
  c90834: number | null;
  c90837: number | null;
  c90853: number | null;
  c99214: number | null;
}

export interface RateTableData {
  payer: RateTablePayer;
  rows: RateTableRow[];
  /** Max payer file_date — the publication date the footer must always show. */
  asOf: string | null;
}

/** 'ein:262976526' → 'EIN ···6526'. Last 4 only on screen; the full value stays
 *  searchable client-side. (lib/repos/tin-registry.ts#formatTin renders the FULL
 *  EIN — deliberately not reused here.) */
export function maskTin(tin: string): string {
  const digits = tin.replace(/\D/g, "");
  if (digits.length < 4) return tin;
  return `${tin.startsWith("npi:") ? "NPI" : "EIN"} ···${digits.slice(-4)}`;
}

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
  /** The insurer that published this rate. A TIN appears once per insurer, so
   *  (payer, tin) — not tin — is the row identity. */
  payer: RateTablePayer;
  /** NULL when no name resolved — the UI renders "Unnamed practice · N clinicians". */
  displayName: string | null;
  entityKind: "individual" | "organization";
  /** Individual-only (raw, unnormalized — what the provider recognizes). */
  credential: string | null;
  /** Individual-only, uppercase + punctuation-stripped — what the filter chips group on. */
  credentialNorm: string | null;
  /** Roster NPIs, empty for rosters > 25 (platform TINs). Client-side NPI search. */
  npis: string[];
  /** Roster size — NPIs billing under this TIN. */
  nProviders: number;
  /** 1-based label for a TIN with no resolved name ("Unnamed practice 41").
   *  Stable: assigned per distinct TIN in tin order, so the same entity keeps
   *  its number across insurers and across page loads. NULL when named. */
  unnamedNo: number | null;
  c90791: number | null;
  c90834: number | null;
  c90837: number | null;
  c90853: number | null;
  c99214: number | null;
}

export interface RateTableData {
  rows: RateTableRow[];
  /**
   * Publication date (max file_date) PER insurer — never one date for the whole
   * table. The books are months apart (Cigna 2026-07-01 vs MetroPlus 2024-02-07)
   * so a single folded date would render MetroPlus's two-year-old book as fresh.
   * The footer names each one.
   */
  asOfByPayer: Partial<Record<RateTablePayer, string>>;
}

/** Row identity: the MV's grain is (payer, tin), and a TIN recurs across insurers. */
export function rateRowKey(r: RateTableRow): string {
  return `${r.payer}::${r.tin}`;
}

// The billing IDENTIFIER — what the insurer publishes to say who it pays.
//
// In the CMS Transparency in Coverage schema a provider group is
// `{npi: [...], tin: {type, value}}` where type is 'ein' or 'npi'. So this value
// is not "the TIN": it is whichever identifier that payer chose, and the choice
// is the PAYER's, not the provider's (measured 2026-07-14) —
//   Empire 100% npi · Fidelis/MetroPlus 100% ein · Cigna 72/28 · Oxford 65/35.
// 28,210 NPIs appear under both kinds. An NPI is not a tax ID, so this must
// never be labelled "TIN" in the UI.
export type BillingIdKind = "EIN" | "NPI";

export function billingIdKind(tin: string): BillingIdKind {
  return tin.startsWith("npi:") ? "NPI" : "EIN";
}

/** 'ein:262976526' → '26-2976526'; 'npi:1265047799' → '1265047799'. */
export function billingIdValue(tin: string): string {
  const d = tin.replace(/\D/g, "");
  return billingIdKind(tin) === "EIN" && d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2)}` : d;
}

/**
 * The MEMBER's NPI — the provider who bills under this group — or null when the
 * group has more than one and there is no single answer.
 *
 * Deliberately NOT the identifier: for 1,074 npi-identified rows the identifier
 * is not a member's NPI at all (939 of them are the GROUP's own NPI-2, e.g.
 * npi:1629049192 = MEMORIAL GASTROENTEROLOGY GROUP). Reading the NPI off the
 * identifier printed an organisation's NPI in a column headed "NPI" next to a
 * person's name. Read the roster instead — it is the only thing that actually
 * holds member NPIs.
 */
export function rowNpi(r: RateTableRow): string | null {
  return r.npis.length === 1 ? r.npis[0] : null;
}

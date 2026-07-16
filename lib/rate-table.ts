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

/** The five codes, in table order. `name` is the plain-English header tooltip + legend.
 *  `key` holds the single rate (NULL unless exactly one); `nKey` holds how many
 *  distinct rates the payer published — see rateCell() for why both exist. */
export const RATE_CODES = [
  { key: "c90791", nKey: "n90791", code: "90791", name: "Diagnostic evaluation" },
  { key: "c90834", nKey: "n90834", code: "90834", name: "Psychotherapy 45 min" },
  { key: "c90837", nKey: "n90837", code: "90837", name: "Psychotherapy 60 min" },
  { key: "c90853", nKey: "n90853", code: "90853", name: "Group psychotherapy" },
  { key: "c99214", nKey: "n99214", code: "99214", name: "Established patient visit" },
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
  /** Child-only: the clinician's discipline + city, rendered beside their name
   *  ("Becker Jessica · Psychiatrist · Brighton"). Parents carry neither — a
   *  group has many disciplines and often many cities, and one of each would be
   *  a lie. */
  profession?: string | null;
  city?: string | null;
  /** Child-only: the two things that make a published row unique besides the
   *  person. Columns, not a GROUP BY — see sql/032. */
  network?: string | null;
  setting?: string | null;
  /**
   * How many rows the payer published under this billing ID — one per
   * (NPI, network, setting). THE ROW'S SHAPE:
   *   1  -> the row IS that published row; it shows dollars.
   *   >1 -> the row is a GROUP HEADER: empty across every rate column, opens.
   * Children always carry 1.
   */
  nLeaves: number;
  /** Roster NPIs, empty for rosters > 25 (platform TINs). Client-side NPI search. */
  npis: string[];
  /** Roster size — NPIs billing under this TIN. */
  nProviders: number;
  /** 1-based label for a TIN with no resolved name ("Unnamed practice 41").
   *  Stable: assigned per distinct TIN in tin order, so the same entity keeps
   *  its number across insurers and across page loads. NULL when named. */
  unnamedNo: number | null;
  /** The single published rate, or NULL when the payer published 0 or several. */
  c90791: number | null;
  c90834: number | null;
  c90837: number | null;
  c90853: number | null;
  c99214: number | null;
  /** How many DISTINCT rates the payer published for this row + code. */
  n90791: number;
  n90834: number;
  n90837: number;
  n90853: number;
  n99214: number;
  /**
   * The clinicians billing under this group, for groups of 2-25 (sql/032).
   * Absent for solo groups (the row IS the clinician) and platform TINs (a
   * 13,614-row roster is a payload, not a reading — /orgs owns those).
   */
  children?: RateTableRow[];
  /** True on a clinician row nested under its billing group. */
  isChild?: boolean;
}

/**
 * What a rate cell actually says. Three states, and the third is the one the
 * page exists for:
 *   n = 0  -> the payer published nothing here. The ONLY honest "—".
 *   n = 1  -> that rate.
 *   n > 1  -> the payer published n different rates. Show the COUNT.
 *
 * The count is not a fallback for a missing value — it is the page's thesis at
 * cell scale. The headline is "Cigna pays 395 DIFFERENT RATES for a 60-minute
 * session"; a table that renders "—" whenever that count exceeds one is a table
 * that hides its own argument. Corpus 395, practice 4, clinician 10 — one
 * statistic, three altitudes.
 *
 * Picking one of the n is still forbidden (it invents a fact the payer never
 * published). Counting them invents nothing.
 */
export function rateCell(row: RateTableRow, i: number): { rate: number | null; n: number } {
  const c = RATE_CODES[i];
  return { rate: row[c.key] as number | null, n: (row[c.nKey] as number) ?? 0 };
}

/** A group header: more than one published row underneath, so it summarizes
 *  nothing and renders empty. Its children carry the numbers. */
export const isGroupHeader = (r: RateTableRow): boolean => !r.isChild && r.nLeaves > 1;

/**
 * The payer publishes `place_of_service` as a pipe-joined list of CMS service
 * codes, which is unreadable and long ('01|03|04|09|11|12|13|14|15|...'). These
 * lists are not arbitrary — they are the standard non-facility / facility split,
 * and the difference between them is a real price difference: Georgianna Dart's
 * Cigna 90791 is $137.47 in an office and $133.02 in a facility.
 *   11 = Office  ->  the non-facility list
 *   21/22 = Inpatient / Outpatient Hospital  ->  the facility list
 * 'CSTM-00' is Cigna's own marker, not a CMS code, and is left as "Custom" —
 * naming it something friendlier would be inventing a meaning we do not know.
 */
export function settingLabel(setting: string | null | undefined): string {
  if (!setting) return "";
  if (setting === "CSTM-00") return "Custom";
  const codes = setting.split("|");
  if (codes.includes("11")) return "Office";
  if (codes.includes("21") || codes.includes("22")) return "Facility";
  return codes.length > 2 ? `${codes.length} settings` : setting;
}

/** 'Cigna national-oap' -> 'national-oap'. The insurer already has its own column. */
export const networkLabel = (n: string | null | undefined, payer: string): string =>
  !n ? "" : n.replace(new RegExp(`^${payer.split(" ")[0]}\\s+`, "i"), "");

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

/** Row identity: the parent MV's grain is (payer, tin), and a TIN recurs across
 *  insurers. A child adds its NPI — the same clinician appears under every group
 *  they bill through, which is the whole point of showing them. */
export function rateRowKey(r: RateTableRow): string {
  const base = `${r.payer}::${r.tin}`;
  // A child's grain is (payer, tin, npi, network, setting) — sql/032 — so the
  // NPI alone is not identity: one clinician bills the same group under several
  // networks, and office vs facility is a real price difference (Dart's 90791 is
  // $137.47 vs $133.02). Keying on the NPI collapsed those onto one key.
  return r.isChild ? `${base}::${r.npis[0] ?? "?"}::${r.network ?? ""}::${r.setting ?? ""}` : base;
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

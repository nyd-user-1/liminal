// Insurance dropdown options — shared by the server pages (which prepend the
// payers we actually hold data for, via listPayerFacets) and the client search
// group (as its default). Lives outside any "use client" module so server
// components can iterate it.
//
// DEMO MODE (Brendan, 2026-07-11): the dropdown lists every carrier discussed
// in the payer research, with real insurer marks where the blob store has one
// and the two-tone `id-card` icon as the placeholder elsewhere. Carriers we
// hold no data for route through the API's legacy path (Leuk practitioners
// only, directory honestly excluded) — which carriers stay is a later call.

const LOGO_BASE = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/logos/insurance";

export type InsuranceOption = {
  value: string;
  label: string;
  /** Insurer mark (blob asset) — rendered as a small contained image. */
  image?: string;
  /** Two-tone icon fallback for carriers without a mark. */
  iconName?: string;
};

/** Insurer marks we actually have in the blob store, keyed by payer name. */
const LOGOS: Record<string, string> = {
  Cigna: `${LOGO_BASE}/cigna.avif`,
  UnitedHealthcare: `${LOGO_BASE}/united.avif`,
  Aetna: `${LOGO_BASE}/aetna.avif`,
  Anthem: `${LOGO_BASE}/anthem.avif`,
  Carelon: `${LOGO_BASE}/carelon.avif`,
  Oscar: `${LOGO_BASE}/optum-oscar.avif`,
  Healthfirst: `${LOGO_BASE}/healthfirst.svg`,
};

const leadFor = (name: string): Pick<InsuranceOption, "image" | "iconName"> =>
  LOGOS[name] ? { image: LOGOS[name] } : { iconName: "id-card" };

export const BASE_INSURANCE_OPTIONS: InsuranceOption[] = [
  { value: "", label: "Any insurance" },
  // True of every NY directory row by construction (source-constrained).
  { value: "Medicaid", label: "Medicaid", iconName: "id-card" },
];

/** Every carrier discussed in the payer research — demo filler; no data yet. */
const DEMO_CARRIERS = [
  "Aetna",
  "Anthem",
  "Carelon",
  "CDPHP",
  "EmblemHealth",
  "Excellus BCBS",
  "Fidelis Care",
  "Healthfirst",
  "MetroPlus",
  "Molina",
  "MVP Health Care",
  "Oscar",
  "Oxford",
];

/**
 * Full dropdown list: Any/Medicaid, then payers with real harvested data
 * (value = payer slug the search API filters on), then the demo carriers we
 * hold nothing for (value = display name → legacy no-data path), deduped.
 */
export function buildInsuranceOptions(
  payerFacets: Array<{ slug: string; name: string }>,
): InsuranceOption[] {
  const covered = payerFacets.map((f) => ({ value: f.slug, label: f.name, ...leadFor(f.name) }));
  const coveredNames = new Set(payerFacets.map((f) => f.name));
  const demo = DEMO_CARRIERS.filter((n) => !coveredNames.has(n)).map((n) => ({
    value: n,
    label: n,
    ...leadFor(n),
  }));
  // "Any insurance" stays pinned on top (it's the clear-filter); everything
  // else — Medicaid included — sorts A–Z.
  const [any, ...rest] = BASE_INSURANCE_OPTIONS;
  return [any, ...[...rest, ...covered, ...demo].sort((a, b) => a.label.localeCompare(b.label))];
}

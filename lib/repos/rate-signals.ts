import { hasDb, sql } from "@/lib/db";
import { isoDateOnly, isoDateTime } from "@/lib/format";
import {
  mockAttestations,
  mockRateBands,
  mockRateBandsTiered,
  mockRateNames,
  mockRateSignals,
  mockTinCohorts,
  mockTinOrgs,
  type MockAttestationRow,
  type MockRateSignalRow,
} from "@/lib/mock/rate-signals";

// Negotiated-rate signals repo (provider_rate_signals, sql/017) — the ONLY
// door to Transparency-in-Coverage rates. Dual-mode: hasDb ? sql : fixtures.
//
// THE THREE DISPLAY RULES — enforced here, structurally:
//  1. A negotiated rate is what the PAYER pays the PROVIDER, never patient
//     cost. This module NEVER returns a bare number: the figure only leaves
//     pre-wrapped in `display` ("$233.40 in-network rate · as-of 2026-07-12")
//     so no page can fetch a number and mislabel it as what a patient pays.
//  2. A rate proves a contract existed on file_date — carry as_of on every
//     rate-derived claim.
//  3. MEMBERSHIP vs LIVENESS: a rate row is the payer's OWN published
//     attestation that the provider is in-network — "takes Oxford" is a fair
//     claim on rate evidence alone. What the rate file does NOT carry is
//     accepting-new-patients or any recency heartbeat (published rates
//     outlive active participation — the zombie-rate problem CMS's proposed
//     Utilization File exists to fix). `directoryListed` gates ONLY those
//     liveness/accepting claims, never the membership claim itself.

export interface RateSignal {
  payer: string;
  planOrNetwork: string;
  /** As published — 'ein:XXXXXXXXX' | 'npi:XXXXXXXXXX' (some payers dash EINs). */
  tin: string;
  billingCode: string;
  billingClass: string;
  placeOfService: string;
  /** The only form the figure exists in: "$233.40 in-network rate · as-of 2026-07-12". */
  display: string;
  /** Same wrapped figure without the as-of suffix — pair with `asOf` in a column. */
  rateDisplay: string;
  /** Formatted figure alone ("$146.00") — only for layouts whose column
   *  headers carry the in-network qualifier and whose Schedule column carries
   *  `basis`. Non-dollar types keep their qualifier attached. */
  figure: string;
  /** Schedule basis label: "Fee schedule" | "Negotiated" | …. */
  basis: string;
  /** ISO date the claim is good as of (effective date if published, else our fetch date). */
  asOf: string;
  /** ISO date the payer published the MRF. */
  fileDate: string;
  /**
   * true = the SAME payer also lists this NPI in its FHIR directory, which
   * unlocks accepting-new-patients display. false = rate-file evidence only:
   * membership is still solid (it is the payer's own disclosure); there is
   * simply no accepting/liveness data to show alongside it.
   */
  directoryListed: boolean;
}

// Map an MRF reporting-entity name to our payer_sources slug so the directory
// join is same-payer only (a Humana listing says nothing about Oxford
// accepting-status). Oxford maps to null: no public FHIR directory exists
// (probed 2026-07-12), so Oxford rows carry no accepting data — membership is
// unaffected.
const PAYER_TO_SOURCE_SLUG: Array<[RegExp, string | null]> = [
  [/oxford/i, null],
  [/unitedhealthcare|united healthcare|\buhc\b/i, "uhc"],
  [/aetna/i, "aetna_commercial"],
  [/cigna/i, "cigna"],
  [/anthem|empire|elevance/i, "elevance"],
  [/healthfirst/i, "healthfirst"],
];

function sourceSlugForPayer(payer: string): string | null {
  for (const [re, slug] of PAYER_TO_SOURCE_SLUG) if (re.test(payer)) return slug;
  return null;
}

// NY-book entities: named for NY, or NY-market payers we pulled deliberately.
// Everything else = other-state entities off shared BCBS hosts — BlueCard/
// reach signals, never NY membership. Lifted from scripts/mrf/rollup.mjs;
// keep the two in lockstep.
const NY_ENTITY_RE =
  /new york|of ny|cdphp|oxford|metroplus|carelon|emblem|centene|fidelis|cigna|western new york|empire|excellus/i;

// TiC dollar-figure types: negotiated / fee schedule / derived / per diem are
// all payer→provider dollars ('fee schedule' alone is ~2/3 of the table);
// 'percentage' is percent-of-billed and must never render as "$".
const DOLLAR_TYPE_RE = /negotiated|fee schedule|per diem|derived/i;

/** 'ein:83-2675429' → 'ein:832675429' — payers dash/space EINs inconsistently. */
function normTin(tin: string): string {
  return tin.toLowerCase().replace(/[\s-]/g, "");
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function count(n: number): string {
  return n.toLocaleString("en-US");
}

function signedMoney(n: number): string {
  return `${n < 0 ? "−" : "+"}${money(Math.abs(n))}`;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// The wrapped figure without its as-of suffix — for table layouts that carry
// as-of in a sibling column. Still never a bare number: the in-network label
// and type qualifier travel with the figure.
function figureDisplay(rate: number | string, negotiatedType: string): string {
  // Non-dollar types (percentage) are qualified explicitly rather than
  // rendered as a dollar figure; dollar types other than plain 'negotiated'
  // carry their type as a qualifier.
  const n = Number(rate);
  const type = negotiatedType.toLowerCase();
  if (!DOLLAR_TYPE_RE.test(type)) return `${n} (${type}) in-network rate`;
  const qualifier = type === "negotiated" ? "" : ` (${type})`;
  return `${money(n)} in-network rate${qualifier}`;
}

function display(rate: number | string, negotiatedType: string, asOf: string): string {
  return `${figureDisplay(rate, negotiatedType)} · as-of ${asOf}`;
}

// Structured split of figureDisplay for table layouts where the in-network
// qualifier lives in the column header and the schedule basis in its own
// column. Dollar figures come out formatted ("$146.00"); non-dollar types
// keep their qualifier attached (never a bare number).
function figureParts(rate: number | string, negotiatedType: string): { figure: string; basis: string } {
  const n = Number(rate);
  const type = negotiatedType.toLowerCase();
  const basis = type.charAt(0).toUpperCase() + type.slice(1);
  if (!DOLLAR_TYPE_RE.test(type)) return { figure: `${n} (${type})`, basis };
  return { figure: money(n), basis };
}

type SignalRow = {
  payer: string;
  plan_or_network: string;
  tin: string;
  billing_code: string;
  negotiated_rate: string;
  billing_class: string;
  negotiated_type: string;
  place_of_service: string;
  file_date: string | Date;
  as_of: string | Date;
};

/**
 * All rate signals for an NPI, figure pre-labeled, directory join resolved.
 * "In-network with {payer} — per the payer's published rate file" is a fair
 * claim from any row; add accepting-new-patients only when directoryListed.
 * Never a patient cost.
 */
export async function getRateSignals(npi: string): Promise<RateSignal[]> {
  if (!hasDb) {
    return mockRateSignals
      .filter((r) => r.npi === npi)
      .map((r: MockRateSignalRow) => ({
        payer: r.payer,
        planOrNetwork: r.planOrNetwork,
        tin: r.tin,
        billingCode: r.billingCode,
        billingClass: r.billingClass,
        placeOfService: r.placeOfService,
        display: display(r.negotiatedRate, r.negotiatedType, r.asOf),
        rateDisplay: figureDisplay(r.negotiatedRate, r.negotiatedType),
        ...figureParts(r.negotiatedRate, r.negotiatedType),
        asOf: r.asOf,
        fileDate: r.fileDate,
        directoryListed: false, // fixtures mirror today's reality: no same-payer directory rows
      }));
  }

  const rows = (await sql`
    SELECT payer, plan_or_network, tin, billing_code, negotiated_rate, billing_class,
           negotiated_type, place_of_service, file_date, as_of
    FROM provider_rate_signals
    WHERE npi = ${npi}
    ORDER BY payer, plan_or_network, billing_code, billing_class, negotiated_rate
  `) as SignalRow[];
  if (!rows.length) return [];

  // Same-payer directory listings for this NPI → corroboration flags.
  const listed = (await sql`
    SELECT DISTINCT ps.slug
    FROM provider_network_participation pnp
    JOIN payer_sources ps ON ps.id = pnp.payer_source_id
    WHERE pnp.npi = ${npi}
  `) as Array<{ slug: string }>;
  const listedSlugs = new Set(listed.map((r) => r.slug));

  return rows.map((r) => {
    const asOf = isoDateOnly(r.as_of);
    const slug = sourceSlugForPayer(r.payer);
    return {
      payer: r.payer,
      planOrNetwork: r.plan_or_network,
      tin: r.tin,
      billingCode: r.billing_code,
      billingClass: r.billing_class,
      placeOfService: r.place_of_service,
      display: display(r.negotiated_rate, r.negotiated_type, asOf),
      rateDisplay: figureDisplay(r.negotiated_rate, r.negotiated_type),
      ...figureParts(r.negotiated_rate, r.negotiated_type),
      asOf,
      fileDate: isoDateOnly(r.file_date),
      directoryListed: !!slug && listedSlugs.has(slug),
    };
  });
}

// ── aggregate accessors (the "Know Your Rates" screens) ──────────────────────
// Same discipline as getRateSignals: every figure leaves pre-wrapped, medians
// and bands are computed on deduped rows (distinct npi × payer × code × rate,
// dollar types only), NY-book entities only, and every band carries its as-of.

/** A payer book of ≥ this many clinicians on one TIN = a platform/aggregator
 *  holds the contract, not a practice (Headway NY runs ~3,100 in Oxford's book). */
const PLATFORM_COHORT_MIN = 500;

const DEFAULT_MIN_CLINICIANS = 25;

/** License tiers, bucketed from the statewide directory profession by NPI —
 *  real data (NPPES/Medicaid), covering essentially every rated NY-book NPI. */
export const LICENSE_TIERS = ["Masters-level", "Psychologist", "Prescriber (MD/NP)"] as const;

export interface RateBand {
  payer: string;
  /** The network(s) this schedule rides: one name, "A · B", or "All networks"
   *  when every network the payer publishes shows the same figures. */
  network: string;
  billingCode: string;
  /** One of LICENSE_TIERS — the band is computed within the tier. */
  license: string;
  /** Distinct clinicians behind the band — evidence weight, not a rate figure. */
  clinicians: number;
  cliniciansDisplay: string;
  /** Formatted percentile figures ("$98.75") — the in-network qualifier is
   *  carried by the consuming surface (table column headers, the rate card's
   *  preamble), not repeated per figure. */
  p25: string;
  median: string;
  p75: string;
  /** p25 == p75 → the payer publishes one schedule; a wide band → groups negotiate. */
  negotiability: "flat" | "negotiated";
  negotiabilityLabel: "Flat schedule" | "Negotiated per group";
  /** ISO date — max as_of among contributing rows. Render alongside the band. */
  asOf: string;
  asOfDisplay: string;
}

type BandNumbers = {
  payer: string;
  billing_code: string;
  license: string | null;
  /** plan_or_network — only populated on the byLicense (negotiation-card) path. */
  network: string | null;
  npis: number;
  p25: number;
  median: number;
  p75: number;
  as_of: string;
};

// Numeric bands stay module-private: getRateBands wraps them for display and
// computeSpread does its arithmetic here, so no bare payer rate ever crosses
// out of this file. `byLicense` splits each payer×code band into license
// tiers via the directory profession join; the un-split shape serves the
// spread arithmetic (a platform remit has no license dimension attached).
async function bandNumbers(
  codes: string[],
  minClinicians: number,
  byLicense = false,
): Promise<BandNumbers[]> {
  if (!hasDb) {
    const src = byLicense ? mockRateBandsTiered : mockRateBands;
    return src
      .filter((b) => codes.includes(b.billingCode) && b.clinicians >= minClinicians)
      .map((b) => ({
        payer: b.payer,
        billing_code: b.billingCode,
        license: "license" in b ? (b.license as string) : null,
        network: null,
        npis: b.clinicians,
        p25: b.p25,
        median: b.median,
        p75: b.p75,
        as_of: b.asOf,
      }));
  }
  // Reads sql/024's precomputed matviews — same dedup subquery + license CASE
  // as the live queries these replaced (20-30s at 9M rows), just materialized.
  // `codes`/`minClinicians` move from the aggregate's WHERE/HAVING to a plain
  // filter over the tiny rollup, since neither is fixed per call.
  const rows = (byLicense
    ? await sql`
        SELECT payer, billing_code, license, network, npis, p25, median, p75, as_of
        FROM rate_bands_license_summary
        WHERE billing_code = ANY(${codes}) AND npis >= ${minClinicians}
        ORDER BY payer, billing_code, license, network
      `
    : await sql`
        SELECT payer, billing_code, NULL AS license, NULL AS network, npis, p25, median, p75, as_of
        FROM rate_bands_payer_summary
        WHERE billing_code = ANY(${codes}) AND npis >= ${minClinicians}
        ORDER BY payer, billing_code
      `) as Array<Omit<BandNumbers, "as_of"> & { as_of: string | Date }>;
  return rows.map((r) => ({ ...r, as_of: isoDateOnly(r.as_of) }));
}

/**
 * Per-payer × CPT × license-tier p25/median/p75 — the negotiation card. Bands
 * are ammunition for the ask, not a guarantee of an offer. License tier comes
 * from the statewide directory (NPPES/Medicaid profession), so the tier rows
 * are real cohorts, not a heuristic.
 */
export async function getRateBands(
  codes: string[],
  opts: { minClinicians?: number } = {},
): Promise<RateBand[]> {
  const rows = await bandNumbers(codes, opts.minClinicians ?? DEFAULT_MIN_CLINICIANS, true);

  // Bands are computed per network (verified 2026-07-12: MetroPlus pays
  // $377.62 FFS vs $293.70 QHP for the same 90837; Oxford OHBS $137.78 vs
  // Freedom $286.13 — pooling blurred real schedules and corrupted the
  // flat/negotiated inference, which is only sound within one network).
  // Networks whose figures are identical merge back into one row, so payers
  // publishing one schedule across products (Highmark WNY's five networks,
  // Fidelis) stay a single line. A merged row's clinician count is the
  // largest single-network cohort — product rosters overlap, so summing
  // would double-count.
  const scopeNetworks = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.network) continue;
    const scope = `${r.payer}|${r.billing_code}|${r.license}`;
    let set = scopeNetworks.get(scope);
    if (!set) scopeNetworks.set(scope, (set = new Set()));
    set.add(r.network);
  }
  const merged = new Map<string, { row: BandNumbers; networks: string[] }>();
  for (const r of rows) {
    const scope = `${r.payer}|${r.billing_code}|${r.license}`;
    const key = `${scope}|${r.p25}|${r.median}|${r.p75}`;
    const hit = merged.get(key);
    if (!hit) {
      merged.set(key, { row: { ...r }, networks: r.network ? [r.network] : [] });
    } else {
      hit.row.npis = Math.max(hit.row.npis, r.npis);
      if (r.as_of > hit.row.as_of) hit.row.as_of = r.as_of;
      if (r.network) hit.networks.push(r.network);
    }
  }

  return [...merged.values()].map(({ row: r, networks }) => {
    const scopeSize = scopeNetworks.get(`${r.payer}|${r.billing_code}|${r.license}`)?.size ?? 0;
    const network =
      networks.length === 0 || networks.length === scopeSize ? "All networks" : networks.sort().join(" · ");
    const flat = r.p25 === r.p75;
    return {
      payer: r.payer,
      network,
      billingCode: r.billing_code,
      license: r.license ?? "All",
      clinicians: r.npis,
      cliniciansDisplay: `${count(r.npis)} clinicians`,
      p25: money(r.p25),
      median: money(r.median),
      p75: money(r.p75),
      negotiability: flat ? "flat" : "negotiated",
      negotiabilityLabel: flat ? "Flat schedule" : "Negotiated per group",
      asOf: r.as_of,
      asOfDisplay: `as-of ${r.as_of}`,
    } as const;
  });
}

export interface TinCohortBook {
  payer: string;
  clinicians: number;
  display: string;
}

export interface TinCohort {
  /** Normalized TIN ('ein:832675429'); dashed/spaced published forms fold in. */
  tin: string;
  /** Distinct clinicians on this TIN in the largest single payer book. */
  clinicians: number;
  platformScale: boolean;
  display: string;
  byPayer: TinCohortBook[];
}

function buildCohort(tinNorm: string, books: Array<{ payer: string; clinicians: number }>): TinCohort {
  const byPayer = books
    .slice()
    .sort((a, b) => b.clinicians - a.clinicians)
    .map((b) => ({
      payer: b.payer,
      clinicians: b.clinicians,
      display: `${count(b.clinicians)} clinician${b.clinicians === 1 ? "" : "s"} on this TIN in ${b.payer}'s book`,
    }));
  const top = byPayer[0];
  const clinicians = top?.clinicians ?? 0;
  const platformScale = clinicians >= PLATFORM_COHORT_MIN;
  return {
    tin: tinNorm,
    clinicians,
    platformScale,
    display: platformScale
      ? `Contract held by a platform group — ${count(clinicians)} clinicians on this TIN in ${top.payer}'s book`
      : top
        ? top.display
        : "No published rows for this TIN",
    byPayer,
  };
}

// One pass for many TINs (no index on tin — every lookup is a scan, so batch).
async function cohortsForTins(tins: string[]): Promise<Map<string, TinCohort>> {
  const norms = [...new Set(tins.map(normTin))];
  const out = new Map<string, TinCohort>();
  if (norms.length === 0) return out;

  let rows: Array<{ tin_norm: string; payer: string; clinicians: number }>;
  if (!hasDb) {
    rows = mockTinCohorts
      .filter((c) => norms.includes(c.tinNorm))
      .map((c) => ({ tin_norm: c.tinNorm, payer: c.payer, clinicians: c.clinicians }));
  } else {
    rows = (await sql`
      SELECT replace(replace(lower(tin), '-', ''), ' ', '') AS tin_norm,
             payer, count(DISTINCT npi)::int AS clinicians
      FROM provider_rate_signals
      WHERE replace(replace(lower(tin), '-', ''), ' ', '') = ANY(${norms})
      GROUP BY 1, 2
    `) as Array<{ tin_norm: string; payer: string; clinicians: number }>;
  }

  for (const norm of norms) {
    const books = rows.filter((r) => r.tin_norm === norm);
    out.set(norm, buildCohort(norm, books));
  }
  return out;
}

/** Cohort behind one TIN — who actually holds the contract the rates ride on. */
export async function getTinCohort(tin: string): Promise<TinCohort> {
  const cohorts = await cohortsForTins([tin]);
  return cohorts.get(normTin(tin))!;
}

// ── org names (tin_registry) ─────────────────────────────────────────────────
// tin_registry is being built in a PARALLEL terminal — it may not exist yet.
// Every read here is try/catch → null/empty so nothing in this module gates
// on it; when the table lands, org names appear with zero code change here.

/** 'ein:262976526' → 'EIN 26-2976526'; 'npi:1234567893' → 'org NPI 1234567893'. */
function formatTinFallback(tinNorm: string): string {
  const einMatch = tinNorm.match(/^ein:(\d+)$/);
  if (einMatch) {
    const digits = einMatch[1];
    return digits.length === 9 ? `EIN ${digits.slice(0, 2)}-${digits.slice(2)}` : `EIN ${digits}`;
  }
  const npiMatch = tinNorm.match(/^npi:(\d+)$/);
  if (npiMatch) return `org NPI ${npiMatch[1]}`;
  return tinNorm;
}

/** holder = the org name when known, else the formatted EIN/NPI fallback. */
function holderFor(tinNorm: string, orgName: string | null | undefined): { holder: string; orgKnown: boolean } {
  return orgName ? { holder: orgName, orgKnown: true } : { holder: formatTinFallback(tinNorm), orgKnown: false };
}

/** Business name behind a TIN, from tin_registry — null when unknown or the
 *  table isn't built yet. Never throws. */
export async function getOrgName(tin: string): Promise<string | null> {
  const norm = normTin(tin);
  if (!hasDb) return mockTinOrgs[norm] ?? null;
  try {
    const rows = (await sql`
      SELECT business_name FROM tin_registry WHERE tin_norm = ${norm} LIMIT 1
    `) as Array<{ business_name: string }>;
    return rows[0]?.business_name ?? null;
  } catch {
    return null; // table not built yet
  }
}

/** Batch org-name lookup — one query for many TINs, empty map on any failure
 *  (table missing, column mismatch) so callers never gate on it. */
async function orgNamesFor(tins: string[]): Promise<Map<string, string>> {
  const norms = [...new Set(tins.map(normTin))];
  const out = new Map<string, string>();
  if (norms.length === 0) return out;
  if (!hasDb) {
    for (const n of norms) {
      const name = mockTinOrgs[n];
      if (name) out.set(n, name);
    }
    return out;
  }
  try {
    const rows = (await sql`
      SELECT tin_norm, business_name FROM tin_registry WHERE tin_norm = ANY(${norms})
    `) as Array<{ tin_norm: string; business_name: string }>;
    for (const r of rows) out.set(r.tin_norm, r.business_name);
  } catch {
    // tin_registry isn't built yet — ship the EIN fallback, nothing gates on this
  }
  return out;
}

export interface StandingRate {
  billingCode: string;
  /** Wrapped figure, no as-of suffix: "$146.00 in-network rate (fee schedule)". */
  display: string;
  /** Formatted figure alone ("$146.00") — pair with a header-qualified column + `basis`. */
  figure: string;
  /** Schedule basis label: "Fee schedule" | "Negotiated" | …. */
  basis: string;
  /** ISO date — render alongside the figure (its own column). */
  asOf: string;
}

export interface StandingGroup {
  payer: string;
  /** TIN as published (first form seen); cohort is keyed on the normalized form. */
  tin: string;
  /** false ⇒ other-state/BlueCard entity: reach while traveling, never NY membership. */
  nyBook: boolean;
  directoryListed: boolean;
  planOrNetworks: string[];
  /** Deduped (code, display) — plan variants publishing the same figure collapse. */
  rates: StandingRate[];
  asOf: string;
  cohort: TinCohort | null;
}

export interface NpiStanding {
  npi: string;
  /** From the statewide directory when the NPI is known there (all-caps as stored). */
  providerName: string | null;
  profession: string | null;
  groups: StandingGroup[];
}

/**
 * Screen-one composite: every (payer, TIN) book that lists the NPI, with the
 * attached rate strings and the TIN's cohort — the "who holds your contract"
 * reveal. An empty `groups` means "no published rows for this NPI", which is
 * NOT "not in-network": coverage has real gaps (some payers blocked our pulls,
 * out-of-state-address clinicians are missing — see docs/TASK-TELEHEALTH-GAP.md).
 */
export async function getStanding(npi: string): Promise<NpiStanding> {
  const signals = await getRateSignals(npi);

  let providerName: string | null = null;
  let profession: string | null = null;
  if (!hasDb) {
    const hit = mockRateNames[npi];
    providerName = hit?.name ?? null;
    profession = hit?.profession ?? null;
  } else {
    const named = (await sql`
      SELECT name, profession FROM directory_providers
      WHERE npi = ${npi} AND name IS NOT NULL
      ORDER BY (source = 'medicaid') DESC
      LIMIT 1
    `) as Array<{ name: string; profession: string | null }>;
    providerName = named[0]?.name ?? null;
    profession = named[0]?.profession ?? null;
  }

  const cohorts = await cohortsForTins(signals.map((s) => s.tin));

  const groups = new Map<string, StandingGroup>();
  for (const s of signals) {
    const key = `${normTin(s.tin)}|${s.payer}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        payer: s.payer,
        tin: s.tin,
        nyBook: NY_ENTITY_RE.test(s.payer),
        directoryListed: s.directoryListed,
        planOrNetworks: [],
        rates: [],
        asOf: s.asOf,
        cohort: cohorts.get(normTin(s.tin)) ?? null,
      };
      groups.set(key, g);
    }
    if (!g.planOrNetworks.includes(s.planOrNetwork)) g.planOrNetworks.push(s.planOrNetwork);
    const dup = g.rates.find((r) => r.billingCode === s.billingCode && r.display === s.rateDisplay);
    if (!dup)
      g.rates.push({ billingCode: s.billingCode, display: s.rateDisplay, figure: s.figure, basis: s.basis, asOf: s.asOf });
    else if (s.asOf > dup.asOf) dup.asOf = s.asOf;
    if (s.asOf > g.asOf) g.asOf = s.asOf;
  }

  for (const g of groups.values()) g.rates.sort((a, b) => a.billingCode.localeCompare(b.billingCode));

  return {
    npi,
    providerName,
    profession,
    // NY book first — reach entities are a different, weaker kind of claim.
    groups: [...groups.values()].sort(
      (a, b) => Number(b.nyBook) - Number(a.nyBook) || a.payer.localeCompare(b.payer),
    ),
  };
}

// The behavioral CPTs carried by provider_rate_signals (mirrors
// components/rates/cpt.ts — this module can't import a "use client" file).
const BEHAVIORAL_FIVE = ["90791", "90834", "90837", "90853", "99214"];

// Distinct NY-book payers we index — stable within a process, so cache it.
let checkedBooksCache: string[] | null = null;
async function getCheckedBooks(): Promise<string[]> {
  if (checkedBooksCache) return checkedBooksCache;
  if (!hasDb) {
    checkedBooksCache = [...new Set(mockRateBands.map((b) => b.payer))].filter((p) => NY_ENTITY_RE.test(p)).sort();
    return checkedBooksCache;
  }
  // sql/024's rate_bands_checked_payers matview — the live DISTINCT scan took
  // ~12s at 9M rows, paid on every cold process before the cache warmed.
  const rows = (await sql`SELECT payer FROM rate_bands_checked_payers`) as Array<{ payer: string }>;
  checkedBooksCache = rows.map((r) => r.payer).sort();
  return checkedBooksCache;
}

export interface FootprintBook {
  payer: string;
  networks: string[];
  tin: string;
  holder: string;
  orgKnown: boolean;
  platformScale: boolean;
  /** billingCode → wrapped figure, no as-of suffix. */
  codes: Record<string, string>;
  /**
   * billingCode → the same figure split into { figure, basis } — for the card
   * layout whose HEADER carries the in-network qualifier and whose Schedule
   * BADGE carries the basis once, rather than "(fee schedule)" repeated down
   * every line. Same sanctioned split `RateSignal.figure`/`basis` already use;
   * `codes` stays the wrapped form for everyone else (recruiting-shell).
   */
  codeParts: Record<string, { figure: string; basis: string }>;
  asOf: string;
}

export interface FootprintIdentity {
  name: string;
  profession: string | null;
  license: string | null;
  /** Primary NUCC taxonomy code, when the directory carries it. */
  taxonomy: string | null;
  /** "123 Main St, New York, NY 10001" — whatever the directory holds. */
  address: string | null;
}

export interface CredentialingFootprint {
  npi: string;
  identity: FootprintIdentity | null;
  /** NY-book entities only. */
  foundIn: FootprintBook[];
  /** Every distinct NY-book payer we index. */
  checkedBooks: string[];
  /** checkedBooks − foundIn payers. */
  absentFrom: string[];
}

/**
 * The recruiting/credentialing reveal: every NY-book payer this NPI is
 * already published in (which pays it forward the moment a group adds them
 * to the roster), the ones it's verified-absent from, and the identity strip
 * from the statewide directory when we have it. Built on getStanding — same
 * evidence, reshaped for "which books, which holders, which gaps."
 */
export async function getCredentialingFootprint(npi: string): Promise<CredentialingFootprint> {
  const standing = await getStanding(npi);
  const checkedBooks = await getCheckedBooks();
  const nyGroups = standing.groups.filter((g) => g.nyBook);

  const orgNames = await orgNamesFor(nyGroups.map((g) => g.tin));
  const foundIn: FootprintBook[] = nyGroups.map((g) => {
    const norm = normTin(g.tin);
    const { holder, orgKnown } = holderFor(norm, orgNames.get(norm));
    const codes: Record<string, string> = {};
    const codeParts: Record<string, { figure: string; basis: string }> = {};
    for (const r of g.rates) {
      codes[r.billingCode] = r.display;
      codeParts[r.billingCode] = { figure: r.figure, basis: r.basis };
    }
    return {
      payer: g.payer,
      networks: g.planOrNetworks,
      tin: g.tin,
      holder,
      orgKnown,
      platformScale: g.cohort?.platformScale ?? false,
      codes,
      codeParts,
      asOf: g.asOf,
    };
  });

  const foundPayers = new Set(foundIn.map((f) => f.payer));
  const absentFrom = checkedBooks.filter((p) => !foundPayers.has(p));

  let identity: CredentialingFootprint["identity"] = null;
  if (!hasDb) {
    const hit = mockRateNames[npi];
    if (hit) identity = { name: hit.name, profession: hit.profession, license: null, taxonomy: null, address: null };
  } else {
    const rows = (await sql`
      SELECT name, profession, license_no, license_state, COALESCE(primary_taxonomy, taxonomy) AS taxonomy,
             address, city, zip
      FROM directory_providers
      WHERE npi = ${npi} AND name IS NOT NULL
      ORDER BY (source = 'medicaid') DESC
      LIMIT 1
    `) as Array<{
      name: string;
      profession: string | null;
      license_no: string | null;
      license_state: string | null;
      taxonomy: string | null;
      address: string | null;
      city: string | null;
      zip: string | null;
    }>;
    const r = rows[0];
    if (r) {
      const addressParts = [r.address, r.city && `${r.city}, NY`, r.zip].filter(Boolean);
      identity = {
        name: r.name,
        profession: r.profession,
        license: r.license_no ? (r.license_state ? `${r.license_no} (${r.license_state})` : r.license_no) : null,
        taxonomy: r.taxonomy,
        address: addressParts.length > 0 ? addressParts.join(", ") : null,
      };
    }
  }

  return { npi, identity, foundIn, checkedBooks, absentFrom };
}

// ── percentile placement + a TIN's own schedule ───────────────────────────────

/** A TIN's median deduped rate for a payer+code — the contract's own
 *  published schedule, used by percentile placement and the Roster Check
 *  spread (Moment 2, vs the group's contract rather than the payer median). */
async function tinScheduleRates(payer: string, tin: string, codes: string[]): Promise<Map<string, number>> {
  const norm = normTin(tin);
  const out = new Map<string, number>();
  if (codes.length === 0) return out;
  if (!hasDb) {
    for (const code of codes) {
      const rates = mockRateSignals
        .filter((r) => r.payer === payer && r.billingCode === code && normTin(r.tin) === norm)
        .map((r) => r.negotiatedRate);
      if (rates.length) out.set(code, median(rates));
    }
    return out;
  }
  const rows = (await sql`
    WITH dd AS (
      SELECT DISTINCT billing_code, negotiated_rate
      FROM provider_rate_signals
      WHERE payer = ${payer} AND billing_code = ANY(${codes})
        AND replace(replace(lower(tin), '-', ''), ' ', '') = ${norm}
        AND negotiated_type NOT ILIKE '%percent%'
    )
    SELECT billing_code, percentile_cont(0.5) WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2)::float8 AS median
    FROM dd GROUP BY billing_code
  `) as Array<{ billing_code: string; median: number }>;
  for (const r of rows) out.set(r.billing_code, r.median);
  return out;
}

/** Piecewise-linear placement estimate through (p25,25)/(median,50)/(p75,75)
 *  for mock mode, where we only carry the three percentile points rather than
 *  a raw distribution. Clamped to [1,99] — never claim the exact edge. */
function estimatePercentile(p25: number, med: number, p75: number, rate: number): number {
  if (p25 === med && med === p75) return 50;
  const points: Array<[number, number]> = [
    [0, p25 - (med - p25)],
    [25, p25],
    [50, med],
    [75, p75],
    [100, p75 + (p75 - med)],
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if ((rate >= y0 && rate <= y1) || (rate <= y0 && rate >= y1)) {
      if (y1 === y0) return Math.round((x0 + x1) / 2);
      return Math.round(x0 + ((rate - y0) / (y1 - y0)) * (x1 - x0));
    }
  }
  return rate < p25 ? 1 : 99;
}

/**
 * Where a TIN's published schedule sits inside the payer's book — "p38" style
 * — the Roster Check pivot ("the contract left. the rates don't have to.").
 * Null when either side has no rows.
 */
export async function getPercentilePlacement(
  payer: string,
  billingCode: string,
  tin: string,
): Promise<string | null> {
  const norm = normTin(tin);
  if (!hasDb) {
    const rateRow = mockRateSignals.find(
      (r) => r.payer === payer && r.billingCode === billingCode && normTin(r.tin) === norm,
    );
    const band = mockRateBands.find((b) => b.payer === payer && b.billingCode === billingCode);
    if (!rateRow || !band) return null;
    const pct = Math.max(1, Math.min(99, estimatePercentile(band.p25, band.median, band.p75, rateRow.negotiatedRate)));
    return `p${pct}`;
  }
  const rows = (await sql`
    WITH dd AS (
      SELECT DISTINCT npi, tin, negotiated_rate
      FROM provider_rate_signals
      WHERE payer = ${payer} AND billing_code = ${billingCode}
        AND negotiated_type NOT ILIKE '%percent%'
    ),
    tin_rate AS (
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY negotiated_rate) AS rate
      FROM dd
      WHERE replace(replace(lower(tin), '-', ''), ' ', '') = ${norm}
    )
    SELECT
      (SELECT rate FROM tin_rate) AS tin_rate,
      count(*)::int AS total,
      count(*) FILTER (WHERE negotiated_rate <= (SELECT rate FROM tin_rate))::int AS le_count
    FROM dd
  `) as Array<{ tin_rate: number | null; total: number; le_count: number }>;
  const r = rows[0];
  if (!r || r.tin_rate === null || r.total === 0) return null;
  const pct = Math.max(1, Math.min(99, Math.round((100 * r.le_count) / r.total)));
  return `p${pct}`;
}

export interface SpreadEntry {
  billingCode: string;
  /** What the caller's platform remits them per session, in dollars (their own number). */
  remit: number;
  /** Session volume in the given cadence. */
  sessions: number;
  /** "week" annualizes over working weeks (default 48); "month" over 12 months. */
  cadence?: "week" | "month";
}

export interface PayerCodeSpread {
  billingCode: string;
  /** "+$31.78 per 90837 session vs this payer's median" — or the no-band notice. */
  display: string;
  covered: boolean;
}

export interface PayerSpread {
  payer: string;
  perCode: PayerCodeSpread[];
  /** "≈ +$21,900/yr at your volume" (+ coverage note when a code has no band). */
  annualDisplay: string;
  /** Direction only — drives the tint, never reveals the figure. */
  positive: boolean;
}

export interface SpreadResult {
  payers: PayerSpread[];
  /** The biggest gap, StatCard-sized: "≈ +$21,900/yr". Null when nothing matched. */
  headline: { payer: string; display: string; detail: string } | null;
  /** Render once next to the results — the settled evidence-model caveats. */
  assumptions: string;
}

const SPREAD_WEEKS_DEFAULT = 48;

/**
 * The spread check — caller supplies their remit per CPT + weekly volume; the
 * arithmetic against payer medians happens HERE so no bare payer rate crosses
 * to the client. Annualized figures are rounded to the nearest $100: bands are
 * ammunition, and false precision reads as a promise.
 */
export async function computeSpread(
  entries: SpreadEntry[],
  opts: { weeksPerYear?: number; minClinicians?: number; schedule?: { payer: string; tin: string } } = {},
): Promise<SpreadResult> {
  const weeks = Math.min(52, Math.max(1, Math.round(opts.weeksPerYear ?? SPREAD_WEEKS_DEFAULT)));
  const valid = entries.filter(
    (e) =>
      /^\d{5}$/.test(e.billingCode) &&
      Number.isFinite(e.remit) &&
      e.remit >= 0 &&
      Number.isFinite(e.sessions) &&
      e.sessions >= 0,
  );
  const empty: SpreadResult = { payers: [], headline: null, assumptions: "" };
  if (valid.length === 0) return empty;

  // Roster Check moment 2: compare against the TIN's own published schedule
  // instead of the payer's book median — one payer only, "the margin your
  // work generated" framing (we never guess their comp; the user typed it).
  if (opts.schedule) {
    const { payer, tin } = opts.schedule;
    const codes = [...new Set(valid.map((e) => e.billingCode))];
    const rates = await tinScheduleRates(payer, tin, codes);
    if (rates.size === 0) return empty;

    let annualTotal = 0;
    let covered = 0;
    const perCode: PayerCodeSpread[] = valid.map((e) => {
      const rate = rates.get(e.billingCode);
      if (rate === undefined) {
        return { billingCode: e.billingCode, display: `no published rate for ${e.billingCode} on this contract`, covered: false };
      }
      const perSession = rate - e.remit;
      const annualSessions = e.cadence === "month" ? e.sessions * 12 : e.sessions * weeks;
      annualTotal += perSession * annualSessions;
      covered += 1;
      return {
        billingCode: e.billingCode,
        display: `${signedMoney(perSession)} per ${e.billingCode} session vs the contract's published rate`,
        covered: true,
      };
    });
    const annual = Math.round(annualTotal / 100) * 100;
    const coverageNote =
      covered < valid.length ? ` · ${covered} of ${valid.length} CPTs have a published rate on this contract` : "";
    const positive = annual > 0;
    const payerResult: PayerSpread = {
      payer,
      perCode,
      annualDisplay: `≈ ${annual < 0 ? "−" : "+"}$${count(Math.abs(annual))}/yr at your volume${coverageNote}`,
      positive,
    };
    return {
      payers: [payerResult],
      headline: positive
        ? {
            payer,
            display: `≈ +$${count(Math.abs(annual))}/yr`,
            detail: "the margin your work generated — the gap between your pay and this contract's published rate, at your volume",
          }
        : null,
      assumptions: `Vs ${payer}'s published rate for this contract, on deduped payer-published rows · weekly volume annualized over ${weeks} working weeks, monthly over 12 months · the margin your work generated — never a guess at your comp, since you supplied it yourself.`,
    };
  }

  const bands = await bandNumbers([...new Set(valid.map((e) => e.billingCode))], opts.minClinicians ?? DEFAULT_MIN_CLINICIANS);
  if (bands.length === 0) return empty;

  const signed = signedMoney;
  const payers = [...new Set(bands.map((b) => b.payer))].map((payer) => {
    let annualTotal = 0;
    let covered = 0;
    const perCode: PayerCodeSpread[] = valid.map((e) => {
      const band = bands.find((b) => b.payer === payer && b.billing_code === e.billingCode);
      if (!band) {
        return { billingCode: e.billingCode, display: `no published band for ${e.billingCode}`, covered: false };
      }
      const perSession = band.median - e.remit;
      const annualSessions = e.cadence === "month" ? e.sessions * 12 : e.sessions * weeks;
      annualTotal += perSession * annualSessions;
      covered += 1;
      return {
        billingCode: e.billingCode,
        display: `${signed(perSession)} per ${e.billingCode} session vs this payer's median`,
        covered: true,
      };
    });
    const annual = Math.round(annualTotal / 100) * 100;
    const coverageNote = covered < valid.length ? ` · ${covered} of ${valid.length} CPTs have a published band` : "";
    return {
      payer,
      perCode,
      annual, // internal — stripped below
      annualDisplay: `≈ ${annual < 0 ? "−" : "+"}$${count(Math.abs(annual))}/yr at your volume${coverageNote}`,
      positive: annual > 0,
    };
  });

  payers.sort((a, b) => b.annual - a.annual);
  const top = payers[0];
  const maxAsOf = bands.reduce((m, b) => (b.as_of > m ? b.as_of : m), bands[0].as_of);
  return {
    payers: payers.map(({ annual: _annual, ...p }) => p),
    headline:
      top && top.positive
        ? {
            payer: top.payer,
            display: `≈ +$${count(Math.abs(top.annual))}/yr`,
            detail: `the gap between your remit and ${top.payer}'s median book, at your volume`,
          }
        : null,
    assumptions: `Vs NY-book payer medians on deduped payer-published rates (as-of ${maxAsOf}) · weekly volume annualized over ${weeks} working weeks, monthly over 12 months · a band is ammunition for the ask, not a guarantee of an offer — and never what a patient pays.`,
  };
}

// ── affiliation attestations (Roster Check write path) ───────────────────────
// Insert-only log — a correction is a new row, never an UPDATE. Latest row
// wins per (npi, normalized tin). This is a proprietary liveness signal, not
// demo glue: validate hard.

export interface Attestation {
  /** As the provider entered it (or as published, when set from a footprint row). */
  tin: string;
  status: "current" | "left";
  /** ISO date, first-of-month — null when not given. */
  attestedMonth: string | null;
  createdAt: string;
}

function assertValidAttestation(input: {
  npi: string;
  tin: string;
  status: string;
  attestedMonth?: string | null;
}): { npi: string; tin: string; status: "current" | "left"; attestedMonth: string | null } {
  const npi = input.npi.trim();
  if (!/^\d{10}$/.test(npi)) throw new Error("Provide a 10-digit NPI.");
  const tin = input.tin.trim();
  if (!tin) throw new Error("Provide a TIN.");
  if (input.status !== "current" && input.status !== "left") throw new Error("Status must be 'current' or 'left'.");
  let attestedMonth: string | null = null;
  if (input.attestedMonth) {
    const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(input.attestedMonth);
    if (!m) throw new Error("Invalid attested month.");
    const [, y, mo] = m;
    const monthNum = Number(mo);
    if (monthNum < 1 || monthNum > 12) throw new Error("Invalid attested month.");
    attestedMonth = `${y}-${mo}-01`;
  }
  return { npi, tin, status: input.status, attestedMonth };
}

/** Records the provider's own statement about a book — never inferred. */
export async function attestAffiliation(input: {
  npi: string;
  tin: string;
  status: "current" | "left";
  attestedMonth?: string | null;
  note?: string;
}): Promise<Attestation> {
  const { npi, tin, status, attestedMonth } = assertValidAttestation(input);
  const note = input.note?.trim() || null;

  if (!hasDb) {
    const row: MockAttestationRow = { npi, tin, status, attestedMonth, note, createdAt: new Date().toISOString() };
    mockAttestations.push(row);
    return { tin: row.tin, status: row.status, attestedMonth: row.attestedMonth, createdAt: row.createdAt };
  }

  const rows = (await sql`
    INSERT INTO provider_affiliation_attestations (npi, tin, status, attested_month, note)
    VALUES (${npi}, ${tin}, ${status}, ${attestedMonth}, ${note})
    RETURNING tin, status, attested_month, created_at
  `) as Array<{ tin: string; status: string; attested_month: string | Date | null; created_at: string | Date }>;
  const r = rows[0];
  return {
    tin: r.tin,
    status: r.status as "current" | "left",
    attestedMonth: r.attested_month ? isoDateOnly(r.attested_month) : null,
    createdAt: isoDateTime(r.created_at),
  };
}

/** Latest attestation per normalized TIN, newest first. */
export async function getAttestations(npi: string): Promise<Attestation[]> {
  if (!hasDb) {
    const latest = new Map<string, MockAttestationRow>();
    for (const r of mockAttestations.filter((r) => r.npi === npi)) latest.set(normTin(r.tin), r);
    return [...latest.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({ tin: r.tin, status: r.status, attestedMonth: r.attestedMonth, createdAt: r.createdAt }));
  }
  const rows = (await sql`
    SELECT DISTINCT ON (replace(replace(lower(tin), '-', ''), ' ', ''))
      tin, status, attested_month, created_at
    FROM provider_affiliation_attestations
    WHERE npi = ${npi}
    ORDER BY replace(replace(lower(tin), '-', ''), ' ', ''), created_at DESC
  `) as Array<{ tin: string; status: string; attested_month: string | Date | null; created_at: string | Date }>;
  return rows.map((r) => ({
    tin: r.tin,
    status: r.status as "current" | "left",
    attestedMonth: r.attested_month ? isoDateOnly(r.attested_month) : null,
    createdAt: isoDateTime(r.created_at),
  }));
}

// ── Apply Next ─────────────────────────────────────────────────────────────

export interface GapCard {
  payer: string;
  /** "Median for your codes: $197.80 in-network (90837) · top quartile $318.77" */
  headline: string;
  /** "≈ $237,400/yr gross at 25 sessions/wk at the median" */
  opportunity: string | null;
  negotiability: "flat" | "negotiated";
  negotiabilityLabel: string;
  asOf: string;
}

function medianFor90837(bands: BandNumbers[], payer: string): number | null {
  return bands.find((b) => b.payer === payer && b.billing_code === "90837")?.median ?? null;
}

/**
 * The absent NY-book payers, ranked and priced — "Shelley needs to apply
 * tonight." Gaps come straight from the footprint; figures are the un-tiered
 * band internals for the candidate's own codes (behavioral five when they
 * carry no rows anywhere).
 */
export async function getApplyNext(
  npi: string,
  opts: { sessionsPerWeek?: number } = {},
): Promise<{ npi: string; identity: CredentialingFootprint["identity"]; gaps: GapCard[] }> {
  const sessionsPerWeek = Math.min(60, Math.max(1, Math.round(opts.sessionsPerWeek ?? 25)));
  const footprint = await getCredentialingFootprint(npi);
  if (footprint.absentFrom.length === 0) return { npi, identity: footprint.identity, gaps: [] };

  const ownCodes = [...new Set(footprint.foundIn.flatMap((f) => Object.keys(f.codes)))];
  const codes = ownCodes.length > 0 ? ownCodes : BEHAVIORAL_FIVE;
  const bands = await bandNumbers(codes, DEFAULT_MIN_CLINICIANS, false);

  const gaps: GapCard[] = footprint.absentFrom.map((payer) => {
    const payerBands = bands.filter((b) => b.payer === payer);
    if (payerBands.length === 0) {
      return {
        payer,
        headline: "No published band yet for your codes in this book.",
        opportunity: null,
        negotiability: "negotiated" as const,
        negotiabilityLabel: "Negotiated per group",
        asOf: "",
      };
    }
    const workhorse = payerBands.find((b) => b.billing_code === "90837") ?? payerBands[0];
    const flat = workhorse.p25 === workhorse.p75;
    const opportunityRaw = Math.round((workhorse.median * sessionsPerWeek * 48) / 100) * 100;
    const asOf = payerBands.reduce((m, b) => (b.as_of > m ? b.as_of : m), payerBands[0].as_of);
    return {
      payer,
      headline: `Median for your codes: ${money(workhorse.median)} in-network (${workhorse.billing_code}) · top quartile ${money(workhorse.p75)}`,
      opportunity: `≈ $${count(opportunityRaw)}/yr gross at ${sessionsPerWeek} sessions/wk at the median`,
      negotiability: flat ? "flat" : "negotiated",
      negotiabilityLabel: flat ? "Flat schedule" : "Negotiated per group",
      asOf,
    };
  });

  // Rank by 90837 median descending; a payer with no 90837 band sorts last.
  gaps.sort((a, b) => {
    const am = medianFor90837(bands, a.payer);
    const bm = medianFor90837(bands, b.payer);
    if (am === null && bm === null) return 0;
    if (am === null) return 1;
    if (bm === null) return -1;
    return bm - am;
  });

  return { npi, identity: footprint.identity, gaps };
}

// ── Affiliation Economics ─────────────────────────────────────────────────

export interface EconCode {
  billingCode: string;
  /** "$151.50 in-network", sorted desc by rate. */
  entries: Array<{ tin: string; holder: string; display: string }>;
  /** "38% apart" — computed here, never in the UI. */
  gapDisplay: string;
}

export interface EconCard {
  payer: string;
  codes: EconCode[];
  framing: "hours" | "roster";
}

/**
 * Payers that list this NPI under 2+ distinct TINs with actually-different
 * schedules — the honest version of "which TIN pays more." Framing flips to
 * "roster" (no arbitrage copy) the moment any involved TIN is attested left.
 */
export async function getAffiliationEconomics(npi: string): Promise<EconCard[]> {
  const standing = await getStanding(npi);
  const byPayer = new Map<string, StandingGroup[]>();
  for (const g of standing.groups) {
    if (!g.nyBook) continue;
    byPayer.set(g.payer, [...(byPayer.get(g.payer) ?? []), g]);
  }
  const multiTinPayers = [...byPayer.entries()].filter(
    ([, groups]) => new Set(groups.map((g) => normTin(g.tin))).size >= 2,
  );
  if (multiTinPayers.length === 0) return [];

  const attestations = await getAttestations(npi);
  const attByTin = new Map(attestations.map((a) => [normTin(a.tin), a.status]));
  const orgNames = await orgNamesFor(multiTinPayers.flatMap(([, groups]) => groups.map((g) => g.tin)));

  const cards: EconCard[] = [];
  for (const [payer, groups] of multiTinPayers) {
    const tins = [...new Set(groups.map((g) => g.tin))];
    const codes = [...new Set(groups.flatMap((g) => g.rates.map((r) => r.billingCode)))];

    const perTinRates = new Map<string, Map<string, number>>();
    for (const tin of tins) perTinRates.set(tin, await tinScheduleRates(payer, tin, codes));

    const econCodes: EconCode[] = [];
    for (const code of codes) {
      const entries = tins
        .map((tin) => {
          const rate = perTinRates.get(tin)?.get(code);
          if (rate === undefined) return null;
          const norm = normTin(tin);
          const { holder } = holderFor(norm, orgNames.get(norm));
          return { tin, holder, rate };
        })
        .filter((e): e is { tin: string; holder: string; rate: number } => e !== null)
        .sort((a, b) => b.rate - a.rate);
      if (entries.length < 2) continue;
      const distinctRates = new Set(entries.map((e) => e.rate));
      if (distinctRates.size < 2) continue; // schedules must actually differ

      const top = entries[0].rate;
      const bottom = entries[entries.length - 1].rate;
      const gapPct = Math.round(((top - bottom) / bottom) * 100);
      econCodes.push({
        billingCode: code,
        entries: entries.map((e) => ({ tin: e.tin, holder: e.holder, display: `${money(e.rate)} in-network` })),
        gapDisplay: `${gapPct}% apart`,
      });
    }
    if (econCodes.length === 0) continue;

    const anyLeft = tins.map(normTin).some((t) => attByTin.get(t) === "left");
    cards.push({ payer, codes: econCodes, framing: anyLeft ? "roster" : "hours" });
  }
  return cards;
}

// ── the book listing (Roster check's base content) ────────────────────────────

export interface RateBookRow {
  tin: string;
  payer: string;
  /** The contract holder's display name — "Unnamed practice" when tin_registry
   *  can't name it (sql/027 already resolves this). */
  holder: string;
  county: string | null;
  clinicians: number;
  /** The workhorse figure alone ("$146.00"), for a column whose header carries
   *  the in-network qualifier. null when this book publishes no 90837. */
  workhorse: string | null;
  asOf: string;
}

/**
 * The payer×holder books, biggest rosters first — the LISTING the Roster check
 * opens on.
 *
 * The screen was additive (blank until you typed an NPI, which is a search box
 * asking you to guess what it knows). It is reductive now: this returns the
 * whole listing, `q` narrows it by payer or holder, and `npi` reduces it to the
 * books that actually publish that clinician. Reads sql/027's rate_table_mv —
 * 38,716 rows, already aggregated per (payer, tin) — never the 9.3M-row fact
 * table.
 *
 * SCOPE, and the caller must say so rather than imply "everything": 027 carries
 * a deliberate payer ALLOWLIST — six insurers (Cigna, Empire, Oxford,
 * EmblemHealth, Fidelis, MetroPlus). Both Aetna labels are excluded on purpose
 * (7.9M of the 9.3M rows, only ~4% of which resolve to a single rate per
 * billing ID), as are the out-of-state Blues and Excellus. So this is every
 * book whose schedule resolves to ONE publishable figure — not every book we
 * hold rates for. `total` counts within that scope.
 *
 * Display rule 1 holds: `workhorse` is the sanctioned figure-alone form
 * (`RateSignal.figure`'s contract), so the caller's column header MUST carry
 * the in-network qualifier.
 */
export async function listRateBooks(
  opts: { q?: string; npi?: string; limit?: number } = {},
): Promise<{ rows: RateBookRow[]; total: number; truncated: boolean }> {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
  const npi = opts.npi && /^\d{10}$/.test(opts.npi) ? opts.npi : null;
  const q = opts.q?.trim() ? `%${opts.q.trim()}%` : null;

  if (!hasDb) {
    // Fixture mode: shape the mock signals into the same listing so the screen
    // is never blank offline (mirrors every other repo's dual-mode branch).
    const seen = new Map<string, RateBookRow>();
    for (const r of mockRateSignals as MockRateSignalRow[]) {
      const key = `${r.payer}|${r.tin}`;
      if (npi && r.npi !== npi) continue;
      if (q && !`${r.payer} ${r.tin}`.toLowerCase().includes(q.replaceAll("%", "").toLowerCase())) continue;
      const hit = seen.get(key);
      if (hit) continue;
      seen.set(key, {
        tin: r.tin,
        payer: r.payer,
        holder: mockTinOrgs[normTin(r.tin)] ?? "Unnamed practice",
        county: null,
        clinicians: 1,
        workhorse: r.billingCode === "90837" ? money(Number(r.negotiatedRate)) : null,
        asOf: r.asOf,
      });
    }
    const rows = [...seen.values()];
    return { rows: rows.slice(0, limit), total: rows.length, truncated: rows.length > limit };
  }

  const rows = (await sql`
    SELECT tin, payer, display_name, county, n_clinicians, c90837, as_of
    FROM rate_table_mv
    WHERE (${npi}::text IS NULL OR ${npi}::text = ANY(npis))
      AND (${q}::text IS NULL OR payer ILIKE ${q} OR display_name ILIKE ${q})
    ORDER BY n_clinicians DESC, payer, display_name
    LIMIT ${limit + 1}
  `) as Array<{
    tin: string;
    payer: string;
    display_name: string | null;
    county: string | null;
    n_clinicians: number;
    c90837: string | null;
    as_of: string | Date;
  }>;

  const [{ n }] = (await sql`
    SELECT count(*)::int AS n
    FROM rate_table_mv
    WHERE (${npi}::text IS NULL OR ${npi}::text = ANY(npis))
      AND (${q}::text IS NULL OR payer ILIKE ${q} OR display_name ILIKE ${q})
  `) as Array<{ n: number }>;

  return {
    rows: rows.slice(0, limit).map((r) => ({
      tin: r.tin,
      payer: r.payer,
      holder: r.display_name ?? "Unnamed practice",
      county: r.county,
      clinicians: r.n_clinicians,
      workhorse: r.c90837 == null ? null : money(Number(r.c90837)),
      asOf: isoDateOnly(r.as_of) ?? "",
    })),
    total: n,
    truncated: rows.length > limit,
  };
}

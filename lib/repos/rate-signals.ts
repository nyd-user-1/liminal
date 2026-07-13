import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";
import {
  mockRateBands,
  mockRateBandsTiered,
  mockRateNames,
  mockRateSignals,
  mockTinCohorts,
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
  const rows = (byLicense
    ? await sql`
        WITH prof AS (
          SELECT DISTINCT ON (npi) npi, profession FROM directory_providers
          WHERE npi IS NOT NULL AND profession IS NOT NULL
          ORDER BY npi, (source = 'medicaid') DESC
        ), dd AS (
          SELECT r.npi, r.payer, r.plan_or_network AS network, r.billing_code, r.negotiated_rate,
                 CASE
                   WHEN p.profession ILIKE '%psychiatr%' THEN 'Prescriber (MD/NP)'
                   WHEN p.profession ILIKE '%psycholog%' THEN 'Psychologist'
                   WHEN p.profession ILIKE '%social worker%' OR p.profession ILIKE '%counselor%'
                     OR p.profession ILIKE '%marriage%' THEN 'Masters-level'
                   ELSE 'Other'
                 END AS license,
                 max(r.as_of) AS as_of
          FROM provider_rate_signals r
          LEFT JOIN prof p ON p.npi = r.npi
          WHERE r.billing_code = ANY(${codes})
            AND r.payer ~* ${NY_ENTITY_RE.source}
            AND r.negotiated_type NOT ILIKE '%percent%'
          GROUP BY 1, 2, 3, 4, 5, 6
        )
        SELECT payer, billing_code, license, network, count(DISTINCT npi)::int AS npis,
               percentile_cont(0.25) WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2)::float8 AS p25,
               percentile_cont(0.5)  WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2)::float8 AS median,
               percentile_cont(0.75) WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2)::float8 AS p75,
               max(as_of) AS as_of
        FROM dd
        WHERE license <> 'Other'
        GROUP BY payer, billing_code, license, network
        HAVING count(DISTINCT npi) >= ${minClinicians}
        ORDER BY payer, billing_code, license, network
      `
    : await sql`
        WITH dd AS (
          SELECT npi, payer, billing_code, negotiated_rate, max(as_of) AS as_of
          FROM provider_rate_signals
          WHERE billing_code = ANY(${codes})
            AND payer ~* ${NY_ENTITY_RE.source}
            AND negotiated_type NOT ILIKE '%percent%'
          GROUP BY 1, 2, 3, 4
        )
        SELECT payer, billing_code, NULL AS license, NULL AS network, count(DISTINCT npi)::int AS npis,
               percentile_cont(0.25) WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2)::float8 AS p25,
               percentile_cont(0.5)  WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2)::float8 AS median,
               percentile_cont(0.75) WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2)::float8 AS p75,
               max(as_of) AS as_of
        FROM dd
        GROUP BY payer, billing_code
        HAVING count(DISTINCT npi) >= ${minClinicians}
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
  opts: { weeksPerYear?: number; minClinicians?: number } = {},
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

  const bands = await bandNumbers([...new Set(valid.map((e) => e.billingCode))], opts.minClinicians ?? DEFAULT_MIN_CLINICIANS);
  if (bands.length === 0) return empty;

  const signed = (n: number) => `${n < 0 ? "−" : "+"}${money(Math.abs(n))}`;
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

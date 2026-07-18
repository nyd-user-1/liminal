import { CPT_LABELS as GENERATED_CPT_LABELS } from "@/lib/cpt-labels.generated";
import { hasDb, sql } from "@/lib/db";
import { titleCase } from "@/lib/format";

// Employers + plans repo (sql/020) — the demand-side graph (NYS-36). Powers
// "Find my plan" (patient), the Plans catalog, and Employer Signals. A plan's
// source_file joins provider_rate_signals, so a plan resolves to real rates.
//
// Rates stay governed by the rate-signals rules: this repo returns plan/network
// identity + counts; when it surfaces a figure it must carry as-of and never be
// framed as a patient's cost (see lib/repos/rate-signals.ts).

export interface Employer {
  ein: string;
  name: string;
  marketType: string | null;
  state: string | null;
  selfFunded: boolean | null;
  planCount: number;
}

export interface Plan {
  planName: string;
  networkProduct: string | null;
  reportingEntity: string | null;
  selfFunded: boolean | null;
  fileSchema: string | null;
  sourceFile: string | null;
  fileDate: string | null;
}

export interface RegistryCarrier {
  /** Title-cased for display; near-duplicate spellings collapsed. */
  name: string;
  /** INS_PRSN_COVERED_EOY_CNT for this contract — per-contract, not the plan total. */
  coveredLives: number | null;
  health: boolean;
  stopLoss: boolean;
}

/** An employer's federal benefit-plan filing, summarized for the detail rail
 *  (sql/040 employer_plan_registry, latest plan year). Public DOL/EFAST2 data —
 *  no PHI. */
export interface EmployerRegistry {
  planYear: number;
  /** TOT_PARTCP_BOY_CNT — the plan headcount the employer itself filed. */
  participants: number | null;
  /** health-first, then covered-lives desc; capped for display. */
  carriers: RegistryCarrier[];
  carrierCount: number;
  /** A stop-loss contract on file — self-funded plans buy stop-loss, so its
   *  presence is the federal-record "self-funded tell" the ToC only implied. */
  selfFundedTell: boolean;
}

const MOCK_EMPLOYERS: Employer[] = [
  { ein: "133957095", name: "The New York and Presbyterian Hospital", marketType: "group", state: "NY", selfFunded: true, planCount: 19 },
  { ein: "116002815", name: "MTA New York City Transit", marketType: "group", state: "NY", selfFunded: true, planCount: 3 },
  { ein: "135562308", name: "New York University", marketType: "group", state: "NY", selfFunded: true, planCount: 3 },
];

/** Employer autocomplete for "Find my plan". Prefix + contains, name order. */
export async function searchEmployers(q: string, limit = 20): Promise<Employer[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  if (!hasDb) {
    const t = term.toLowerCase();
    return MOCK_EMPLOYERS.filter((e) => e.name.toLowerCase().includes(t)).slice(0, limit);
  }
  const rows = (await sql`
    SELECT ein, name, market_type, state, self_funded, plan_count
    FROM employers
    WHERE name ILIKE ${term + "%"} OR name ILIKE ${"%" + term + "%"}
    ORDER BY (name ILIKE ${term + "%"}) DESC, plan_count DESC, name
    LIMIT ${limit}
  `) as Array<Record<string, unknown>>;
  return rows.map(mapEmployer);
}

/** Full employer list for the catalog index (client-side filtered). 2,315 rows
 *  is small enough to ship whole, like the clients index does. */
export async function listEmployers(limit = 3000): Promise<Employer[]> {
  if (!hasDb) return MOCK_EMPLOYERS;
  const rows = (await sql`
    SELECT ein, name, market_type, state, self_funded, plan_count
    FROM employers ORDER BY plan_count DESC, name LIMIT ${limit}
  `) as Array<Record<string, unknown>>;
  return rows.map(mapEmployer);
}

export async function getEmployer(ein: string): Promise<Employer | null> {
  if (!hasDb) return MOCK_EMPLOYERS.find((e) => e.ein === ein) ?? null;
  const rows = (await sql`
    SELECT ein, name, market_type, state, self_funded, plan_count
    FROM employers WHERE ein = ${ein}
  `) as Array<Record<string, unknown>>;
  return rows[0] ? mapEmployer(rows[0]) : null;
}

/** An employer's plans (network products + the file that prices each). */
export async function getPlansForEmployer(ein: string): Promise<Plan[]> {
  if (!hasDb) return [];
  const rows = (await sql`
    SELECT plan_name, network_product, reporting_entity, self_funded,
           file_schema, source_file, file_date
    FROM plans WHERE employer_ein = ${ein}
    ORDER BY file_schema, network_product, plan_name
  `) as Array<Record<string, unknown>>;
  return rows.map(mapPlan);
}

/**
 * The "Find my plan" resolution: for an employer + a provider NPI, the rates
 * this employer's plans actually carry for that provider (joined via the plan's
 * source_file). Figures are pre-labeled with as-of; membership only — never a
 * patient's out-of-pocket.
 */
export async function getPlanRatesForNpi(ein: string, npi: string) {
  if (!hasDb) return [];
  const rows = (await sql`
    SELECT DISTINCT pl.network_product, prs.billing_code,
           prs.negotiated_rate, prs.negotiated_type, prs.as_of
    FROM plans pl
    JOIN provider_rate_signals prs ON prs.source_file = pl.source_file
    WHERE pl.employer_ein = ${ein} AND prs.npi = ${npi}
    ORDER BY pl.network_product, prs.billing_code, prs.negotiated_rate
  `) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    networkProduct: r.network_product as string | null,
    billingCode: r.billing_code as string,
    // pre-labeled per the rate-signals display rule
    display: `$${Number(r.negotiated_rate).toFixed(2)} your plan's in-network rate · as-of ${isoDate(r.as_of)}`,
    asOf: isoDate(r.as_of),
  }));
}

export interface NetworkRateSummary {
  networkProduct: string | null;
  providersPriced: number;
  cpts: Array<{ billingCode: string; median: string; providers: number }>;
}

// The five codes the employer rate summary gives a column to. Which codes is
// this surface's own choice (kept here); the LABELS come from the single source
// (the generated map ← cpt_codes), so the wording never forks.
const SUMMARY_CODES = ["90791", "90834", "90837", "90853", "99214"];
export const CPT_LABELS: Record<string, string> = Object.fromEntries(
  SUMMARY_CODES.map((c) => [c, GENERATED_CPT_LABELS[c] ?? c]),
);

/**
 * Per-network behavioral rate summary for an employer's plans — the catalog
 * payoff. Joins the employer's plan files to provider_rate_signals, deduped
 * (distinct npi×code×rate, dollar types only). Detail-on-demand; one query.
 */
export async function getEmployerRateSummary(ein: string): Promise<NetworkRateSummary[]> {
  if (!hasDb) return [];
  const rows = (await sql`
    WITH emp_files AS (
      SELECT DISTINCT network_product, source_file FROM plans WHERE employer_ein = ${ein}
    ),
    dd AS (
      SELECT DISTINCT ef.network_product, prs.billing_code, prs.npi, prs.negotiated_rate
      FROM emp_files ef
      JOIN provider_rate_signals prs ON prs.source_file = ef.source_file
      WHERE prs.negotiated_type NOT ILIKE '%percent%'
    )
    SELECT network_product, billing_code,
           count(DISTINCT npi)::int AS providers,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY negotiated_rate)::numeric(10,2) AS median
    FROM dd GROUP BY network_product, billing_code
    ORDER BY network_product, billing_code
  `) as Array<Record<string, unknown>>;
  const byNet = new Map<string, NetworkRateSummary>();
  for (const r of rows) {
    const net = (r.network_product as string) ?? "—";
    let s = byNet.get(net);
    if (!s) { s = { networkProduct: net, providersPriced: 0, cpts: [] }; byNet.set(net, s); }
    const providers = Number(r.providers);
    s.cpts.push({ billingCode: r.billing_code as string, median: `$${Number(r.median).toFixed(2)}`, providers });
    // network-level headcount ≈ the largest single-code coverage (eval/therapy)
    if (providers > s.providersPriced) s.providersPriced = providers;
  }
  return [...byNet.values()].sort((a, b) => b.providersPriced - a.providersPriced);
}

const CARRIER_DISPLAY_CAP = 4;

/** Federal registry summary for an employer (sql/040), latest plan year. Named
 *  carriers + covered lives + the stop-loss self-funded tell — the DOL record
 *  behind the ToC-derived employer. Returns null when the employer never filed
 *  (only 64% of our Aetna book matches a filing). */
export async function getEmployerRegistry(ein: string): Promise<EmployerRegistry | null> {
  if (!hasDb) return null;
  const rows = (await sql`
    SELECT plan_year, participants, carrier_name, carrier_naic, covered_lives, benefit_health, benefit_stop_loss
    FROM employer_plan_registry
    WHERE ein = ${ein}
      AND plan_year = (SELECT max(plan_year) FROM employer_plan_registry WHERE ein = ${ein})
  `) as Array<Record<string, unknown>>;
  if (rows.length === 0) return null;

  const planYear = Number(rows[0].plan_year);
  const participants = rows.reduce((m, r) => Math.max(m, Number(r.participants) || 0), 0) || null;

  // The same carrier files under slightly different spellings across contracts
  // ("INS. CO." vs "INSURANCE CO"). Collapse on carrier_naic — the stable NAIC
  // company code, present on 99.6% of rows (share it, they're one carrier) —
  // falling back to a punctuation-insensitive name key only when NAIC is null.
  // Keep the fuller spelling for display, the widest covered-lives, and any flag.
  const byKey = new Map<string, RegistryCarrier & { raw: string }>();
  for (const r of rows) {
    const raw = (r.carrier_name as string | null)?.trim();
    if (!raw) continue;
    const naic = (r.carrier_naic as string | null)?.trim();
    const key = naic || raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cl = r.covered_lives == null ? null : Number(r.covered_lives);
    const cur = byKey.get(key) ?? { name: raw, raw, coveredLives: null, health: false, stopLoss: false };
    if (raw.length > cur.raw.length) cur.raw = raw; // prefer the more complete spelling
    if (cl != null && (cur.coveredLives == null || cl > cur.coveredLives)) cur.coveredLives = cl;
    cur.health = cur.health || r.benefit_health === true;
    cur.stopLoss = cur.stopLoss || r.benefit_stop_loss === true;
    byKey.set(key, cur);
  }
  for (const c of byKey.values()) c.name = titleCase(c.raw);
  // Covered-lives desc, health as the tiebreaker. NOT health-first: a
  // self-funded employer's only INSURED health contract is often a tiny fringe
  // HMO (United files a 2,048-life Hawaii plan) while its real scale sits in a
  // large life/AD&D contract — leading with the fringe plan misrepresents them.
  // Biggest-contract-first is the honest scale; the Health tag still marks which
  // is which, and the tiebreaker floats health above an equal-sized peer.
  const all: RegistryCarrier[] = [...byKey.values()]
    .map(({ raw, ...c }) => c)
    .sort((a, b) => (b.coveredLives ?? -1) - (a.coveredLives ?? -1) || Number(b.health) - Number(a.health));

  return {
    planYear,
    participants,
    carriers: all.slice(0, CARRIER_DISPLAY_CAP),
    carrierCount: all.length,
    selfFundedTell: all.some((c) => c.stopLoss),
  };
}

function mapEmployer(r: Record<string, unknown>): Employer {
  return {
    ein: r.ein as string,
    name: r.name as string,
    marketType: (r.market_type as string) ?? null,
    state: (r.state as string) ?? null,
    selfFunded: (r.self_funded as boolean) ?? null,
    planCount: Number(r.plan_count ?? 0),
  };
}
function mapPlan(r: Record<string, unknown>): Plan {
  return {
    planName: r.plan_name as string,
    networkProduct: (r.network_product as string) ?? null,
    reportingEntity: (r.reporting_entity as string) ?? null,
    selfFunded: (r.self_funded as boolean) ?? null,
    fileSchema: (r.file_schema as string) ?? null,
    sourceFile: (r.source_file as string) ?? null,
    fileDate: r.file_date ? isoDate(r.file_date) : null,
  };
}
function isoDate(v: unknown): string {
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

import { hasDb, sql } from "@/lib/db";

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

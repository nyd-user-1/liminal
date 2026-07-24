import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";
import type { OrgGraph, OrgGraphEdge, OrgGraphNode, OrgGraphRate, PayerGraph } from "@/lib/org-graph";
import { getOrgHeader } from "@/lib/repos/orgs";
import { formatTin, normTin } from "@/lib/repos/tin-registry";

// Relationship graph for ONE organization — the /orgs Map tab's data layer.
// Pure {nodes, edges}: no React, no layout coordinates. The same shape feeds
// the future /chat `relationship_map` tool (generative UI), so keep it that
// way. The shape itself lives in lib/org-graph.ts (db-free) so client
// components can import it without dragging lib/db into the browser.
//
// Shape: member providers → the org → payers. The provider side aggregates
// (~10 named nodes + a "+N more" supernode — Headway alone is 13,614); the
// payer side is small and ships whole. Codes are dynamic: every billing code
// the org has rate rows for.
//
// Chip honesty (ruling 2026-07-23): a cell shows the ONE published rate when
// exactly one distinct dollar value exists (min = max in the rollup — a
// quotable fact), else the COUNT of distinct published rates ("78 rates").
// No medians, no bands: one insurer publishing 78 rates for one code at one
// org IS the finding. Both rollups come from sql/066.
//
// Provider ranking: 'breadth' = most payer books (stable across codes);
// 'rate' = highest published rate for ONE code (org_tin_npi_rates.max_rate —
// the roster reshuffles per code, so the client refetches per code).

export type { OrgGraph, OrgGraphEdge, OrgGraphNode, OrgGraphRate };

export type OrgGraphRank = "breadth" | "rate";

// The "78 rates" drill: the actual distinct published rates for ONE
// (tin, payer, code) cell, with plan/network attribution. Raw facts, not a
// summary — each row is a dollar value the plan itself publishes, so listing
// them stays inside the honesty rules that banned medians. Rides sql/068's
// (tin, payer, billing_code) index.

export type RateDrillPlan = { network: string; npis: number; asOf: string | null };
export type RateDrillRow = {
  rate: number;
  npis: number;
  plans: RateDrillPlan[];
  /** Named when ≤3 clinicians hold this price — "1 clinician" is coy when the
      corpus knows exactly who. Absent for wider tiers. */
  clinicians?: Array<{ npi: string; name: string | null }>;
};

export async function getOrgPayerRateDrill(
  tin: string,
  payer: string,
  code: string,
): Promise<RateDrillRow[]> {
  const key = normTin(tin);
  if (!hasDb) {
    return key === MOCK_GRAPH.tin
      ? [
          { rate: 155.13, npis: 2101, plans: [{ network: "Freedom Network", npis: 2101, asOf: "2026-07-13" }] },
          { rate: 137.78, npis: 3250, plans: [{ network: "Liberty Network", npis: 3250, asOf: "2026-07-13" }] },
        ]
      : [];
  }
  const [byPlanRaw, byRateRaw, namesRaw] = await Promise.all([
    sql`
      SELECT negotiated_rate::float8 AS rate, plan_or_network,
             count(DISTINCT npi)::int AS npis, max(as_of) AS as_of
      FROM provider_rate_signals
      WHERE tin = ${key} AND payer = ${payer} AND billing_code = ${code}
        AND negotiated_type NOT ILIKE '%percent%'
      GROUP BY 1, 2
      ORDER BY 1 DESC, 2
    `,
    // Distinct clinicians per rate ACROSS plans — summing the per-plan counts
    // would double-count an NPI listed in several plans at the same price.
    sql`
      SELECT negotiated_rate::float8 AS rate, count(DISTINCT npi)::int AS npis
      FROM provider_rate_signals
      WHERE tin = ${key} AND payer = ${payer} AND billing_code = ${code}
        AND negotiated_type NOT ILIKE '%percent%'
      GROUP BY 1
    `,
    // Who holds a price, but only where the answer is short (≤3 NPIs): those
    // rows name the clinician instead of counting them.
    sql`
      WITH per AS (
        SELECT negotiated_rate::float8 AS rate, npi
        FROM provider_rate_signals
        WHERE tin = ${key} AND payer = ${payer} AND billing_code = ${code}
          AND negotiated_type NOT ILIKE '%percent%'
        GROUP BY 1, 2
      ),
      small AS (SELECT rate FROM per GROUP BY 1 HAVING count(*) <= 3)
      SELECT p.rate, p.npi, d.name
      FROM per p
      JOIN small s ON s.rate = p.rate
      LEFT JOIN LATERAL (
        SELECT name FROM directory_providers
        WHERE npi = p.npi ORDER BY (source = 'medicaid') DESC LIMIT 1
      ) d ON true
      ORDER BY p.rate DESC, d.name
    `,
  ]);
  const npisByRate = new Map(
    (byRateRaw as Array<{ rate: number; npis: number }>).map((r) => [Number(r.rate), r.npis]),
  );
  const namesByRate = new Map<number, Array<{ npi: string; name: string | null }>>();
  for (const r of namesRaw as Array<{ rate: number; npi: string; name: string | null }>) {
    const rate = Number(r.rate);
    const arr = namesByRate.get(rate) ?? [];
    arr.push({ npi: r.npi, name: r.name });
    namesByRate.set(rate, arr);
  }
  const rows = new Map<number, RateDrillRow>();
  for (const r of byPlanRaw as Array<{ rate: number; plan_or_network: string; npis: number; as_of: Date | null }>) {
    const rate = Number(r.rate);
    const row = rows.get(rate) ?? {
      rate,
      npis: npisByRate.get(rate) ?? 0,
      plans: [],
      ...(namesByRate.has(rate) ? { clinicians: namesByRate.get(rate) } : {}),
    };
    row.plans.push({
      network: r.plan_or_network || "(unnamed plan)",
      npis: r.npis,
      asOf: r.as_of ? isoDateOnly(r.as_of) : null,
    });
    rows.set(rate, row);
  }
  return [...rows.values()];
}

const PROVIDER_NODE_LIMIT = 10;
const PIVOT_ORG_LIMIT = 8;

/** Pivot-on-node: one insurer re-rooted to the top organizations in its
 *  book (by clinician reach), each org→edge carrying the same fact/count
 *  chips. Null when the payer has no book. */
export async function getPayerGraph(payer: string): Promise<PayerGraph | null> {
  if (!hasDb) {
    if (payer !== "Oxford Health Insurance Inc") return null;
    return {
      payer,
      orgCount: 1,
      codes: ["90837"],
      orgs: [
        {
          tin: "ein:832675429",
          label: "New York Medical Behavioral Health Services (Headway NY)",
          clinicians: 3251,
          href: "/orgs/ein%3A832675429",
          rates: { "90837": { kind: "multiple", nRates: 42 } },
        },
      ],
    };
  }
  const [rowsRaw, countRaw] = await Promise.all([
    sql`
      WITH top AS (
        SELECT tin, max(npis)::int AS npis
        FROM org_tin_rate_summary
        WHERE payer = ${payer}
        GROUP BY tin
        ORDER BY 2 DESC, 1
        LIMIT ${PIVOT_ORG_LIMIT}
      )
      SELECT s.tin, s.billing_code, s.distinct_rates, s.min_rate,
             top.npis, t.business_name
      FROM org_tin_rate_summary s
      JOIN top ON top.tin = s.tin
      LEFT JOIN tin_registry t ON t.tin_norm = s.tin
      WHERE s.payer = ${payer}
    `,
    sql`SELECT count(DISTINCT tin)::int AS n FROM org_tin_rate_summary WHERE payer = ${payer}`,
  ]);
  const rows = rowsRaw as Array<{
    tin: string;
    billing_code: string;
    distinct_rates: number;
    min_rate: unknown;
    npis: number;
    business_name: string | null;
  }>;
  if (!rows.length) return null;

  const byTin = new Map<string, { label: string; clinicians: number; rates: Record<string, OrgGraphRate> }>();
  const codes = new Set<string>();
  for (const r of rows) {
    codes.add(r.billing_code);
    const hit = byTin.get(r.tin) ?? {
      label: r.business_name ?? formatTin(r.tin),
      clinicians: r.npis,
      rates: {},
    };
    hit.rates[r.billing_code] =
      r.distinct_rates === 1
        ? { kind: "published", amount: Number(r.min_rate) }
        : { kind: "multiple", nRates: r.distinct_rates };
    byTin.set(r.tin, hit);
  }
  return {
    payer,
    orgCount: (countRaw as Array<{ n: number }>)[0]?.n ?? byTin.size,
    codes: [...codes].sort(),
    orgs: [...byTin.entries()]
      .map(([tin, o]) => ({ tin, ...o, href: `/orgs/${encodeURIComponent(tin)}` }))
      .sort((a, b) => b.clinicians - a.clinicians || a.tin.localeCompare(b.tin)),
  };
}

/** /published-rates deep link: insurer filter + search lands on the org's row. */
function publishedRatesHref(payer: string, tin: string): string {
  const digits = tin.replace(/\D/g, "");
  return `/published-rates?payer=${encodeURIComponent(payer)}&q=${digits}`;
}

const MOCK_GRAPH: OrgGraph = {
  tin: "ein:832675429",
  label: "New York Medical Behavioral Health Services (Headway NY)",
  clinicians: 13614,
  codes: ["90837"],
  nodes: [
    { id: "org", kind: "org", label: "Headway NY", tin: "ein:832675429", clinicians: 13614 },
    { id: "p:1234567893", kind: "provider", label: "Shelley Padgett", npi: "1234567893", profession: "Psychologist", href: "/directory/providers/1234567893" },
    { id: "providers-more", kind: "providersMore", label: "+13,613 more", count: 13613 },
    { id: "y:Oxford Health Insurance Inc", kind: "payer", label: "Oxford Health Insurance Inc", payer: "Oxford Health Insurance Inc", clinicians: 3251, href: publishedRatesHref("Oxford Health Insurance Inc", "ein:832675429") },
  ],
  edges: [
    {
      id: "m:1234567893",
      source: "p:1234567893",
      target: "org",
      kind: "member",
      rates: { "90837": { kind: "published", amount: 135.0 } },
    },
    { id: "m:more", source: "providers-more", target: "org", kind: "member" },
    {
      id: "r:Oxford Health Insurance Inc",
      source: "org",
      target: "y:Oxford Health Insurance Inc",
      kind: "rates",
      payer: "Oxford Health Insurance Inc",
      rates: { "90837": { kind: "multiple", nRates: 42 } },
      asOf: "2026-07-13",
      href: publishedRatesHref("Oxford Health Insurance Inc", "ein:832675429"),
    },
  ],
};

type BandRow = {
  payer: string;
  billing_code: string;
  npis: number;
  distinct_rates: number;
  min_rate: unknown;
  as_of: Date | null;
};

/** The org's relationship map. Providers ranked by `rank` (payer breadth by
 *  default; highest published rate for `code` when rank = 'rate'), each named
 *  provider's own rate counts on their member edge, every payer whose book
 *  the TIN appears in, and per-code chips on the org→payer edges. Null when
 *  the TIN has no roster. */
export async function getOrgGraph(
  tin: string,
  opts: { rank?: OrgGraphRank; code?: string } = {},
): Promise<OrgGraph | null> {
  const key = normTin(tin);
  if (!hasDb) return key === MOCK_GRAPH.tin ? MOCK_GRAPH : null;

  const rank: OrgGraphRank = opts.rank === "rate" && opts.code ? "rate" : "breadth";

  const header = await getOrgHeader(key);
  if (!header) return null;

  const providersQuery =
    rank === "rate"
      ? sql`
          SELECT nr.npi, d.name, d.profession
          FROM org_tin_npi_rates nr
          LEFT JOIN LATERAL (
            SELECT name, profession FROM directory_providers
            WHERE npi = nr.npi ORDER BY (source = 'medicaid') DESC LIMIT 1
          ) d ON true
          WHERE nr.tin = ${key} AND nr.billing_code = ${opts.code}
          ORDER BY nr.max_rate DESC, nr.npi
          LIMIT ${PROVIDER_NODE_LIMIT}
        `
      : sql`
          SELECT r.npi, d.name, d.profession
          FROM org_tin_rosters r
          LEFT JOIN LATERAL (
            SELECT name, profession FROM directory_providers
            WHERE npi = r.npi ORDER BY (source = 'medicaid') DESC LIMIT 1
          ) d ON true
          WHERE r.tin = ${key}
          ORDER BY r.payer_count DESC, (d.name IS NULL), d.name, r.npi
          LIMIT ${PROVIDER_NODE_LIMIT}
        `;

  const [providersRaw, bandsRaw] = await Promise.all([
    providersQuery,
    // Long rows, one per payer × code — every code the org's book carries.
    sql`
      SELECT payer, billing_code, npis, distinct_rates, min_rate, as_of
      FROM org_tin_rate_summary
      WHERE tin = ${key}
    `,
  ]);
  const providers = providersRaw as Array<{ npi: string; name: string | null; profession: string | null }>;
  const bands = bandsRaw as BandRow[];

  // Member-edge chips: each named provider's own published-rate counts under
  // this TIN, from the (tin, npi, code) rollup — same fact test as the payer
  // side (min = max ⇒ one distinct published rate).
  const namedNpis = providers.map((p) => p.npi);
  const memberRatesRaw = namedNpis.length
    ? await sql`
        SELECT npi, billing_code, distinct_rates, min_rate
        FROM org_tin_npi_rates
        WHERE tin = ${key} AND npi = ANY(${namedNpis})
      `
    : [];
  const memberRates = new Map<string, Record<string, OrgGraphRate>>();
  for (const row of memberRatesRaw as Array<{ npi: string; billing_code: string; distinct_rates: number; min_rate: unknown }>) {
    const rates = memberRates.get(row.npi) ?? {};
    rates[row.billing_code] =
      row.distinct_rates === 1
        ? { kind: "published", amount: Number(row.min_rate) }
        : { kind: "multiple", nRates: row.distinct_rates };
    memberRates.set(row.npi, rates);
  }

  const nodes: OrgGraphNode[] = [
    { id: "org", kind: "org", label: header.label, tin: key, clinicians: header.npis },
  ];
  const edges: OrgGraphEdge[] = [];

  for (const p of providers) {
    const id = `p:${p.npi}`;
    nodes.push({
      id,
      kind: "provider",
      label: p.name ?? p.npi,
      npi: p.npi,
      profession: p.profession,
      href: `/directory/providers/${p.npi}`,
    });
    const rates = memberRates.get(p.npi);
    edges.push({ id: `m:${p.npi}`, source: id, target: "org", kind: "member", ...(rates ? { rates } : {}) });
  }
  const overflow = header.npis - providers.length;
  if (overflow > 0) {
    nodes.push({
      id: "providers-more",
      kind: "providersMore",
      label: `+${overflow.toLocaleString("en-US")} more`,
      count: overflow,
    });
    edges.push({ id: "m:more", source: "providers-more", target: "org", kind: "member" });
  }

  const codes = [...new Set(bands.map((b) => b.billing_code))].sort();

  // Group per payer; order payers by clinician reach (max npis), then name.
  const byPayer = new Map<string, BandRow[]>();
  for (const b of bands) {
    const g = byPayer.get(b.payer);
    if (g) g.push(b);
    else byPayer.set(b.payer, [b]);
  }
  const payerGroups = [...byPayer.entries()]
    .map(([payer, rows]) => ({
      payer,
      rows,
      maxNpis: Math.max(...rows.map((r) => r.npis)),
      asOf: rows.reduce<Date | null>((m, r) => (r.as_of && (!m || r.as_of > m) ? r.as_of : m), null),
    }))
    .sort((a, b) => b.maxNpis - a.maxNpis || a.payer.localeCompare(b.payer));

  for (const group of payerGroups) {
    const rates: Record<string, OrgGraphRate> = {};
    for (const r of group.rows) {
      rates[r.billing_code] =
        r.distinct_rates === 1
          ? { kind: "published", amount: Number(r.min_rate) }
          : { kind: "multiple", nRates: r.distinct_rates };
    }
    const id = `y:${group.payer}`;
    nodes.push({
      id,
      kind: "payer",
      label: group.payer,
      payer: group.payer,
      clinicians: group.maxNpis,
      href: publishedRatesHref(group.payer, key),
    });
    edges.push({
      id: `r:${group.payer}`,
      source: "org",
      target: id,
      kind: "rates",
      payer: group.payer,
      rates,
      asOf: group.asOf ? isoDateOnly(group.asOf) : null,
      href: publishedRatesHref(group.payer, key),
    });
  }

  return { tin: key, label: header.label, clinicians: header.npis, codes, nodes, edges };
}

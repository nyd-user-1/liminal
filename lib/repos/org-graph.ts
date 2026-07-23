import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";
import {
  ORG_GRAPH_CODES,
  type OrgGraph,
  type OrgGraphCode,
  type OrgGraphEdge,
  type OrgGraphNode,
  type OrgGraphRate,
} from "@/lib/org-graph";
import { getOrgHeader } from "@/lib/repos/orgs";
import { normTin } from "@/lib/repos/tin-registry";

// Relationship graph for ONE organization — the /orgs Map tab's data layer.
// Pure {nodes, edges}: no React, no layout coordinates. The same shape feeds
// the future /chat `relationship_map` tool (generative UI), so keep it that
// way. The shape itself lives in lib/org-graph.ts (db-free) so client
// components can import its values without dragging lib/db into the browser.
//
// Shape: member providers → the org → payers. The provider side aggregates
// (~10 named nodes + a "+N more" supernode — Headway alone is 13,614); the
// payer side is small and ships whole.
//
// Edge dollars follow the corpus's honesty rules (sql/027 header): a payer's
// SINGLE published rate is a fact and shows as one; when the payer publishes
// several rates for the code, we either show the median across this org's
// clinicians (labeled as a median, from org_tin_rate_summary/sql 025) or the
// count of distinct published rates (rate_table_mv) — never one picked number.

export type { OrgGraph, OrgGraphCode, OrgGraphEdge, OrgGraphNode, OrgGraphRate };

const PROVIDER_NODE_LIMIT = 10;

/** /published-rates deep link: insurer filter + search lands on the org's row. */
function publishedRatesHref(payer: string, tin: string): string {
  const digits = tin.replace(/\D/g, "");
  return `/published-rates?payer=${encodeURIComponent(payer)}&q=${digits}`;
}

const MOCK_GRAPH: OrgGraph = {
  tin: "ein:832675429",
  label: "New York Medical Behavioral Health Services (Headway NY)",
  clinicians: 13614,
  nodes: [
    { id: "org", kind: "org", label: "Headway NY", tin: "ein:832675429", clinicians: 13614 },
    { id: "p:1234567893", kind: "provider", label: "Shelley Padgett", npi: "1234567893", profession: "Psychologist", href: "/directory/providers/1234567893" },
    { id: "providers-more", kind: "providersMore", label: "+13,613 more", count: 13613 },
    { id: "y:Oxford Health Insurance Inc", kind: "payer", label: "Oxford Health Insurance Inc", payer: "Oxford Health Insurance Inc", clinicians: 3251, href: publishedRatesHref("Oxford Health Insurance Inc", "ein:832675429") },
  ],
  edges: [
    { id: "m:1234567893", source: "p:1234567893", target: "org", kind: "member" },
    { id: "m:more", source: "providers-more", target: "org", kind: "member" },
    {
      id: "r:Oxford Health Insurance Inc",
      source: "org",
      target: "y:Oxford Health Insurance Inc",
      kind: "rates",
      payer: "Oxford Health Insurance Inc",
      rates: { "90837": { kind: "median", amount: 137.78, npis: 3250 } },
      asOf: "2026-07-13",
      href: publishedRatesHref("Oxford Health Insurance Inc", "ein:832675429"),
    },
  ],
};

/** The org's relationship map: ~10 named member providers (+ supernode), the
 *  org, every payer whose book it appears in, and per-code dollars on the
 *  org→payer edges. Null when the TIN has no roster. */
export async function getOrgGraph(tin: string): Promise<OrgGraph | null> {
  const key = normTin(tin);
  if (!hasDb) return key === MOCK_GRAPH.tin ? MOCK_GRAPH : null;

  const header = await getOrgHeader(key);
  if (!header) return null;

  const [providersRaw, payerBandsRaw, mvRaw] = await Promise.all([
    sql`
      SELECT r.npi, d.name, d.profession
      FROM org_tin_rosters r
      LEFT JOIN LATERAL (
        SELECT name, profession FROM directory_providers
        WHERE npi = r.npi ORDER BY (source = 'medicaid') DESC LIMIT 1
      ) d ON true
      WHERE r.tin = ${key}
      ORDER BY (d.name IS NULL), d.name, r.npi
      LIMIT ${PROVIDER_NODE_LIMIT}
    `,
    // One row per payer: clinician reach + the median per code (numeric comes
    // back stringly from the driver in places — Number() at the mapper). No
    // billing_code WHERE-filter: a payer whose book carries none of the five
    // graph codes still gets its node (all payers render; its edge just has no
    // dollars) — the FILTER clauses scope the medians to the graph codes.
    sql`
      SELECT payer, max(npis)::int AS npis, max(as_of) AS as_of,
             max(median) FILTER (WHERE billing_code = '90791') AS m90791,
             max(npis)   FILTER (WHERE billing_code = '90791') AS n90791,
             max(median) FILTER (WHERE billing_code = '90834') AS m90834,
             max(npis)   FILTER (WHERE billing_code = '90834') AS n90834,
             max(median) FILTER (WHERE billing_code = '90837') AS m90837,
             max(npis)   FILTER (WHERE billing_code = '90837') AS n90837,
             max(median) FILTER (WHERE billing_code = '90853') AS m90853,
             max(npis)   FILTER (WHERE billing_code = '90853') AS n90853,
             max(median) FILTER (WHERE billing_code = '99214') AS m99214,
             max(npis)   FILTER (WHERE billing_code = '99214') AS n99214
      FROM org_tin_rate_summary
      WHERE tin = ${key}
      GROUP BY payer
      ORDER BY max(npis) DESC, payer
    `,
    sql`
      SELECT payer, as_of,
             c90791, c90834, c90837, c90853, c99214,
             n90791, n90834, n90837, n90853, n99214
      FROM rate_table_mv WHERE tin = ${key}
    `,
  ]);
  const providers = providersRaw as Array<{ npi: string; name: string | null; profession: string | null }>;
  const payerBands = payerBandsRaw as Array<Record<string, unknown> & { payer: string; npis: number; as_of: Date | null }>;
  const mvRows = mvRaw as Array<Record<string, unknown> & { payer: string; as_of: Date | null }>;

  const mvByPayer = new Map(mvRows.map((r) => [r.payer, r]));

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
    edges.push({ id: `m:${p.npi}`, source: id, target: "org", kind: "member" });
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

  for (const band of payerBands) {
    const mv = mvByPayer.get(band.payer);
    const rates: Partial<Record<OrgGraphCode, OrgGraphRate>> = {};
    for (const code of ORG_GRAPH_CODES) {
      const single = mv?.[`c${code}`] != null ? Number(mv[`c${code}`]) : null;
      const nRates = mv ? Number(mv[`n${code}`] ?? 0) : 0;
      const median = band[`m${code}`] != null ? Number(band[`m${code}`]) : null;
      const npis = band[`n${code}`] != null ? Number(band[`n${code}`]) : 0;
      if (single != null) rates[code] = { kind: "published", amount: single };
      else if (median != null) rates[code] = { kind: "median", amount: median, npis };
      else if (nRates > 1) rates[code] = { kind: "multiple", nRates };
    }
    const id = `y:${band.payer}`;
    nodes.push({
      id,
      kind: "payer",
      label: band.payer,
      payer: band.payer,
      clinicians: band.npis,
      href: publishedRatesHref(band.payer, key),
    });
    const asOf = (mv?.as_of as Date | null) ?? band.as_of;
    edges.push({
      id: `r:${band.payer}`,
      source: "org",
      target: id,
      kind: "rates",
      payer: band.payer,
      rates,
      asOf: asOf ? isoDateOnly(asOf) : null,
      href: publishedRatesHref(band.payer, key),
    });
  }

  return { tin: key, label: header.label, clinicians: header.npis, nodes, edges };
}

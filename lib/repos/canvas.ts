import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";
import type { CanvasDoc, CanvasEdges, CanvasMapMeta } from "@/lib/canvas";
import type { OrgGraphRate } from "@/lib/org-graph";

// The /maps builder's data layer: saved-map CRUD (owner-scoped — every
// read/write filters by owner_id; the API layer passes the session user's id)
// and edge hydration. Hydration is the product's core honesty move: a saved
// map stores only nodes, and THIS module re-derives every edge from the rate
// rollups on load, so a map can never show a stale or invented relationship.
// Chip rule matches the org map (ruling 2026-07-23): one distinct published
// rate → the dollar fact; several → the count. Reference data only, no PHI.

export type { CanvasDoc, CanvasEdges, CanvasMapMeta };

// ── saved maps ───────────────────────────────────────────────────────────────

const mockMaps = new Map<string, { meta: CanvasMapMeta; doc: CanvasDoc }>();

export async function listMaps(ownerId: string): Promise<CanvasMapMeta[]> {
  if (!hasDb) {
    return [...mockMaps.values()].map((m) => m.meta).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const rows = (await sql`
    SELECT id, name, updated_at FROM canvas_maps
    WHERE owner_id = ${ownerId} ORDER BY updated_at DESC LIMIT 100
  `) as Array<{ id: string; name: string; updated_at: Date }>;
  return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: isoDateTime(r.updated_at) }));
}

export async function getMap(ownerId: string, id: string): Promise<{ meta: CanvasMapMeta; doc: CanvasDoc } | null> {
  if (!hasDb) return mockMaps.get(id) ?? null;
  const rows = (await sql`
    SELECT id, name, doc, updated_at FROM canvas_maps
    WHERE owner_id = ${ownerId} AND id = ${id} LIMIT 1
  `) as Array<{ id: string; name: string; doc: CanvasDoc; updated_at: Date }>;
  const r = rows[0];
  return r ? { meta: { id: r.id, name: r.name, updatedAt: isoDateTime(r.updated_at) }, doc: r.doc } : null;
}

export async function createMap(ownerId: string, name: string, doc: CanvasDoc): Promise<CanvasMapMeta> {
  if (!hasDb) {
    const meta = { id: `mock-${Date.now()}`, name, updatedAt: new Date().toISOString() };
    mockMaps.set(meta.id, { meta, doc });
    return meta;
  }
  const rows = (await sql`
    INSERT INTO canvas_maps (owner_id, name, doc)
    VALUES (${ownerId}, ${name}, ${JSON.stringify(doc)}::jsonb)
    RETURNING id, name, updated_at
  `) as Array<{ id: string; name: string; updated_at: Date }>;
  const r = rows[0];
  return { id: r.id, name: r.name, updatedAt: isoDateTime(r.updated_at) };
}

export async function updateMap(
  ownerId: string,
  id: string,
  patch: { name?: string; doc?: CanvasDoc },
): Promise<boolean> {
  if (!hasDb) {
    const hit = mockMaps.get(id);
    if (!hit) return false;
    if (patch.name) hit.meta.name = patch.name;
    if (patch.doc) hit.doc = patch.doc;
    hit.meta.updatedAt = new Date().toISOString();
    return true;
  }
  const rows = (await sql`
    UPDATE canvas_maps
    SET name = COALESCE(${patch.name ?? null}, name),
        doc  = COALESCE(${patch.doc ? JSON.stringify(patch.doc) : null}::jsonb, doc),
        updated_at = now()
    WHERE owner_id = ${ownerId} AND id = ${id}
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

export async function deleteMap(ownerId: string, id: string): Promise<boolean> {
  if (!hasDb) return mockMaps.delete(id);
  const rows = (await sql`
    DELETE FROM canvas_maps WHERE owner_id = ${ownerId} AND id = ${id} RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

// ── edge hydration ───────────────────────────────────────────────────────────

const chip = (distinctRates: number, minRate: unknown): OrgGraphRate =>
  distinctRates === 1
    ? { kind: "published", amount: Number(minRate) }
    : { kind: "multiple", nRates: distinctRates };

function publishedRatesHref(payer: string, tin: string): string {
  return `/published-rates?payer=${encodeURIComponent(payer)}&q=${tin.replace(/\D/g, "")}`;
}

/** Every corpus-attested relationship among the given entities. Capped inputs
 *  (the API layer enforces ≤40 per kind); all three queries ride existing
 *  indexes (org_tin_rate_summary tin-leading, org_tin_rosters (tin,npi),
 *  provider_rate_signals idx_prs_npi). */
export async function hydrateCanvasEdges(input: {
  orgs: string[];
  payers: string[];
  providers: string[];
}): Promise<CanvasEdges> {
  const orgs = [...new Set(input.orgs)];
  const payers = [...new Set(input.payers)];
  const providers = [...new Set(input.providers)];
  if (!hasDb) {
    const out: CanvasEdges = { orgPayer: [], providerOrg: [], providerPayer: [] };
    if (orgs.includes("ein:832675429") && payers.includes("Oxford Health Insurance Inc")) {
      out.orgPayer.push({
        tin: "ein:832675429",
        payer: "Oxford Health Insurance Inc",
        rates: { "90837": { kind: "multiple", nRates: 42 } },
        href: publishedRatesHref("Oxford Health Insurance Inc", "ein:832675429"),
      });
    }
    return out;
  }

  const [orgPayerRaw, providerOrgRaw, providerPayerRaw] = await Promise.all([
    orgs.length && payers.length
      ? sql`
          SELECT tin, payer, billing_code, distinct_rates, min_rate
          FROM org_tin_rate_summary
          WHERE tin = ANY(${orgs}) AND payer = ANY(${payers})
        `
      : Promise.resolve([]),
    orgs.length && providers.length
      ? sql`
          SELECT tin, npi FROM org_tin_rosters
          WHERE tin = ANY(${orgs}) AND npi = ANY(${providers})
        `
      : Promise.resolve([]),
    providers.length && payers.length
      ? sql`
          WITH dd AS (
            SELECT npi, payer, billing_code, negotiated_rate
            FROM provider_rate_signals
            WHERE npi = ANY(${providers}) AND payer = ANY(${payers})
              AND negotiated_type NOT ILIKE '%percent%'
            GROUP BY 1, 2, 3, 4
          )
          SELECT npi, payer, billing_code,
                 count(*)::int AS distinct_rates,
                 min(negotiated_rate)::float8 AS min_rate
          FROM dd GROUP BY 1, 2, 3
        `
      : Promise.resolve([]),
  ]);

  const orgPayerMap = new Map<string, { tin: string; payer: string; rates: Record<string, OrgGraphRate> }>();
  for (const r of orgPayerRaw as Array<{ tin: string; payer: string; billing_code: string; distinct_rates: number; min_rate: unknown }>) {
    const k = `${r.tin}|${r.payer}`;
    const hit = orgPayerMap.get(k) ?? { tin: r.tin, payer: r.payer, rates: {} };
    hit.rates[r.billing_code] = chip(r.distinct_rates, r.min_rate);
    orgPayerMap.set(k, hit);
  }

  const providerPayerMap = new Map<string, { npi: string; payer: string; rates: Record<string, OrgGraphRate> }>();
  for (const r of providerPayerRaw as Array<{ npi: string; payer: string; billing_code: string; distinct_rates: number; min_rate: unknown }>) {
    const k = `${r.npi}|${r.payer}`;
    const hit = providerPayerMap.get(k) ?? { npi: r.npi, payer: r.payer, rates: {} };
    hit.rates[r.billing_code] = chip(r.distinct_rates, r.min_rate);
    providerPayerMap.set(k, hit);
  }

  return {
    orgPayer: [...orgPayerMap.values()].map((e) => ({ ...e, href: publishedRatesHref(e.payer, e.tin) })),
    providerOrg: (providerOrgRaw as Array<{ tin: string; npi: string }>).map((r) => ({ npi: r.npi, tin: r.tin })),
    providerPayer: [...providerPayerMap.values()],
  };
}

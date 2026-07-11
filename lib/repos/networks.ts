import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";
import { mockParticipation } from "@/lib/mock/networks";

// Payer-network read repo — the consume-side of the insurance-network tables
// (payer_sources, payer_networks, provider_network_participation) written by
// scripts/ingest-payers.mjs. Joins to the provider directory on `npi`.
//
// Two shapes the UI needs:
//   (a) networkSummariesByNpi — per-provider insurance summary for the card
//       badge + profile "Insurance" block. Batch by the NPIs already on the page.
//   (b) listNetworkFacets — the real, ingested networks (with matched-provider
//       counts) to DRIVE an insurance filter/dropdown. Do not hardcode payers:
//       only networks we actually hold data for should appear.
//
// Dual-mode per the repo convention: hasDb ? sql : mock fixture.

export type AcceptingStatus = "accepting" | "not_accepting" | "unknown";

/** Per-provider rollup across every network/payer we hold for that NPI. */
export interface ProviderNetworkSummary {
  npi: string;
  /** true if the provider is accepting new patients in ANY network we hold. */
  accepting: boolean;
  /** most recent payer-reported update across the provider's rows (ISO), or null. */
  asOf: string | null;
  /** distinct network names, e.g. ["Humana Medicare PPO", …]. */
  networks: string[];
  /** distinct payer names, e.g. ["Humana"]. */
  payers: string[];
}

/** One ingested network, with how many of OUR directory providers are in it. */
export interface NetworkFacet {
  id: string;
  networkName: string;
  payerSlug: string;
  payerName: string;
  providerCount: number;
}

// ── (a) per-provider summary ─────────────────────────────────────────────────

/**
 * Insurance summaries for a batch of NPIs → Map keyed by npi. NPIs with no
 * network data are simply absent from the map (render nothing — absence is NOT
 * "out of network"). Pass the NPIs on the current page; never call per-card.
 */
export async function networkSummariesByNpi(
  npis: Array<string | null | undefined>,
): Promise<Map<string, ProviderNetworkSummary>> {
  const ids = [...new Set(npis.filter((n): n is string => !!n))];
  if (!ids.length) return new Map();

  if (hasDb) {
    const rows = (await sql`
      SELECT p.npi,
             bool_or(p.accepting_new_patients = 'accepting') AS accepting,
             max(p.source_last_updated)                      AS as_of,
             array_agg(DISTINCT n.network_name)              AS networks,
             array_agg(DISTINCT s.name)                      AS payers
      FROM provider_network_participation p
      JOIN payer_networks n ON n.id = p.network_id
      JOIN payer_sources  s ON s.id = p.payer_source_id
      WHERE p.npi = ANY(${ids})
      GROUP BY p.npi
    `) as Array<{
      npi: string;
      accepting: boolean;
      as_of: string | Date | null;
      networks: string[];
      payers: string[];
    }>;
    return new Map(
      rows.map((r) => [
        r.npi,
        {
          npi: r.npi,
          accepting: !!r.accepting,
          asOf: r.as_of ? isoDateTime(r.as_of) : null,
          networks: (r.networks ?? []).filter(Boolean).sort(),
          payers: (r.payers ?? []).filter(Boolean).sort(),
        },
      ]),
    );
  }

  // mock
  const out = new Map<string, ProviderNetworkSummary>();
  for (const id of ids) {
    const rows = mockParticipation.filter((m) => m.npi === id);
    if (!rows.length) continue;
    out.set(id, {
      npi: id,
      accepting: rows.some((m) => m.accepting === "accepting"),
      asOf: rows.map((m) => m.asOf).sort().at(-1) ?? null,
      networks: [...new Set(rows.map((m) => m.networkName))].sort(),
      payers: [...new Set(rows.map((m) => m.payerName))].sort(),
    });
  }
  return out;
}

/** Convenience single-NPI lookup (profile page). */
export async function networkSummaryForNpi(
  npi: string | null | undefined,
): Promise<ProviderNetworkSummary | null> {
  if (!npi) return null;
  return (await networkSummariesByNpi([npi])).get(npi) ?? null;
}

// ── (b) facet list (drives a real insurance filter/dropdown) ─────────────────

/**
 * Networks we've actually ingested, with the count of OUR directory providers
 * in each. Use this to build any insurance filter — NEVER a hardcoded payer
 * list. `minProviders` hides thin networks so the filter's result set is usable
 * (raise it once broad-coverage payers land).
 */
export async function listNetworkFacets(
  opts: { minProviders?: number } = {},
): Promise<NetworkFacet[]> {
  const minProviders = opts.minProviders ?? 1;

  if (hasDb) {
    const rows = (await sql`
      SELECT n.id, n.network_name, s.slug AS payer_slug, s.name AS payer_name,
             count(DISTINCT d.npi)::int AS provider_count
      FROM payer_networks n
      JOIN payer_sources s ON s.id = n.payer_source_id
      LEFT JOIN provider_network_participation p ON p.network_id = n.id
      LEFT JOIN directory_providers d ON d.npi = p.npi
      GROUP BY n.id, n.network_name, s.slug, s.name
      HAVING count(DISTINCT d.npi) >= ${minProviders}
      ORDER BY provider_count DESC, n.network_name
    `) as Array<{ id: string; network_name: string; payer_slug: string; payer_name: string; provider_count: number }>;
    return rows.map((r) => ({
      id: r.id,
      networkName: r.network_name,
      payerSlug: r.payer_slug,
      payerName: r.payer_name,
      providerCount: Number(r.provider_count ?? 0),
    }));
  }

  // mock — aggregate the fixture by network name
  const byName = new Map<string, NetworkFacet>();
  for (const m of mockParticipation) {
    const cur = byName.get(m.networkName) ?? {
      id: m.rawNetworkId ?? m.networkName,
      networkName: m.networkName,
      payerSlug: m.payerSlug,
      payerName: m.payerName,
      providerCount: 0,
    };
    cur.providerCount += 1;
    byName.set(m.networkName, cur);
  }
  return [...byName.values()]
    .filter((f) => f.providerCount >= minProviders)
    .sort((a, b) => b.providerCount - a.providerCount || a.networkName.localeCompare(b.networkName));
}

import { hasDb, sql } from "@/lib/db";
import { isoDateOnly, isoDateTime } from "@/lib/format";
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
 *
 * `payerSlug` restricts the rollup to ONE payer's rows. Pass it whenever an
 * insurance filter is active: the accepting flag is a per-source claim, and
 * showing Humana's "accepting" on a Cigna-filtered list would be a lie.
 */
export async function networkSummariesByNpi(
  npis: Array<string | null | undefined>,
  opts: { payerSlug?: string } = {},
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
      LEFT JOIN payer_networks n ON n.id = p.network_id
      JOIN payer_sources  s ON s.id = p.payer_source_id
      WHERE p.npi = ANY(${ids})
        AND (${opts.payerSlug ?? null}::text IS NULL OR s.slug = ${opts.payerSlug ?? null})
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
    const rows = mockParticipation.filter(
      (m) => m.npi === id && (!opts.payerSlug || m.payerSlug === opts.payerSlug),
    );
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

/** One row per (payer × network) for a single NPI — the un-aggregated version
 *  of the summary above; feeds the profile's unified membership table. Coarse
 *  rows (bare listing, no network detail) come back with network "". */
export interface NetworkParticipationRow {
  payer: string;
  network: string;
  accepting: AcceptingStatus;
  asOf: string | null;
}

export async function networkParticipationForNpi(npi: string): Promise<NetworkParticipationRow[]> {
  if (!npi) return [];
  if (hasDb) {
    const rows = (await sql`
      SELECT s.name AS payer, coalesce(n.network_name, '') AS network,
             max(p.source_last_updated) AS as_of,
             bool_or(p.accepting_new_patients = 'accepting')     AS accepting,
             bool_or(p.accepting_new_patients = 'not_accepting') AS not_accepting
      FROM provider_network_participation p
      LEFT JOIN payer_networks n ON n.id = p.network_id
      JOIN payer_sources s ON s.id = p.payer_source_id
      WHERE p.npi = ${npi}
      GROUP BY s.name, n.network_name
      ORDER BY s.name, n.network_name
    `) as Array<{ payer: string; network: string; as_of: string | Date | null; accepting: boolean; not_accepting: boolean }>;
    return rows.map((r) => ({
      payer: r.payer,
      network: r.network,
      accepting: r.accepting ? "accepting" : r.not_accepting ? "not_accepting" : "unknown",
      asOf: r.as_of ? isoDateTime(r.as_of) : null,
    }));
  }
  // mock — group the fixture by payer + network
  const grouped = new Map<string, NetworkParticipationRow>();
  for (const m of mockParticipation.filter((m) => m.npi === npi)) {
    const k = `${m.payerName}|${m.networkName}`;
    const cur = grouped.get(k);
    if (!cur) {
      grouped.set(k, { payer: m.payerName, network: m.networkName, accepting: m.accepting, asOf: m.asOf });
    } else {
      if (m.accepting === "accepting") cur.accepting = "accepting";
      if (m.asOf && (!cur.asOf || m.asOf > cur.asOf)) cur.asOf = m.asOf;
    }
  }
  return [...grouped.values()].sort((a, b) => a.payer.localeCompare(b.payer) || a.network.localeCompare(b.network));
}

// ── (b′) payer facets (drives the insurance dropdown) ────────────────────────

/** One payer we hold participation data for, with matched count. */
export interface PayerFacet {
  slug: string;
  name: string;
  providerCount: number;
  /** % of matched providers flagged accepting by THIS payer (0-100, rounded). */
  acceptingPct: number;
  /** most recent payer-reported update across the payer's rows (ISO), or null. */
  asOf: string | null;
  /** true when the payer publishes presence only (no networks/accepting) —
      e.g. Healthfirst's bare-roles feed. Listing is still a real directory claim. */
  coarse: boolean;
}

/**
 * Payers with at least one participation row matched to our directory — the
 * option list for the insurance filter. Coarse-only payers (Healthfirst's
 * bare-roles feed) are included and MARKED: "listed in their directory" is a
 * real claim; what coarse rows can't back is a network name or accepting flag
 * (per Brendan 2026-07-11 — surface the listing, never invent the rest).
 */
export async function listPayerFacets(): Promise<PayerFacet[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT s.slug, s.name, count(DISTINCT d.npi)::int AS provider_count,
             count(DISTINCT d.npi) FILTER (WHERE p.accepting_new_patients = 'accepting')::int AS accepting_count,
             max(p.source_last_updated) AS as_of,
             bool_or(p.data_completeness = 'full') AS has_full
      FROM payer_sources s
      JOIN provider_network_participation p ON p.payer_source_id = s.id
      JOIN directory_providers d ON d.npi = p.npi
      GROUP BY s.slug, s.name
      ORDER BY provider_count DESC
    `) as Array<{ slug: string; name: string; provider_count: number; accepting_count: number; as_of: string | Date | null; has_full: boolean }>;
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      providerCount: Number(r.provider_count ?? 0),
      acceptingPct: r.provider_count ? Math.round((Number(r.accepting_count) / Number(r.provider_count)) * 100) : 0,
      asOf: r.as_of ? isoDateTime(r.as_of) : null,
      coarse: !r.has_full,
    }));
  }

  // mock — aggregate the fixture by payer
  const byPayer = new Map<string, { slug: string; name: string; npis: Set<string>; accepting: Set<string>; asOf: string | null }>();
  for (const m of mockParticipation) {
    const cur = byPayer.get(m.payerSlug) ?? { slug: m.payerSlug, name: m.payerName, npis: new Set(), accepting: new Set(), asOf: null };
    cur.npis.add(m.npi);
    if (m.accepting === "accepting") cur.accepting.add(m.npi);
    if (!cur.asOf || m.asOf > cur.asOf) cur.asOf = m.asOf;
    byPayer.set(m.payerSlug, cur);
  }
  return [...byPayer.values()]
    .map((c) => ({
      slug: c.slug, name: c.name, providerCount: c.npis.size,
      acceptingPct: c.npis.size ? Math.round((c.accepting.size / c.npis.size) * 100) : 0,
      asOf: c.asOf,
      coarse: false,
    }))
    .sort((a, b) => b.providerCount - a.providerCount);
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

// ── canonical networks (sql/044, NYS-49) ──────────────────────────────────────
// The 69 deduplicated network entities — insurer + optional administrator
// (Carelon/Optum/Evernorth/…) — the /networks index reads. Distinct from the
// 1,133 raw payer_networks above: this is the resolved layer.
export interface NetworkListRow {
  id: string;
  name: string;
  insurer: string;
  insurerId: string;
  administrator: string | null;
  kind: string;
  notes: string | null;
}

// ── the exact-rate surface (sql/048, NYS-147 §5) ─────────────────────────────
// org_network_rates: one row per (canonical network × billing TIN × code) with
// n_rates honesty. rate_single is THE exact attested figure and exists only
// when the org resolves to one distinct rate; multi-rate orgs (the norm —
// per-NPI contract tiers) must drill to the provider grain for an exact figure.
// Never derive a median from these rows (the binding NYS-37/NYS-35 ruling).

export interface NetworkOrgRateRow {
  tin: string;
  orgName: string | null;
  nNpis: number;
  nRates: number;
  /** Exact attested figure — null when the org carries >1 distinct rate. */
  rateSingle: string | null;
  rateMin: string;
  rateMax: string;
  asOf: string | null;
}

/** Org leaves for one network × code, largest panels first. */
export async function listNetworkOrgRates(
  networkId: string,
  billingCode: string,
  opts: { limit?: number } = {},
): Promise<NetworkOrgRateRow[]> {
  if (!hasDb) return [];
  const limit = opts.limit ?? 500;
  const rows = (await sql`
    SELECT o.tin, t.business_name, o.n_npis, o.n_rates, o.rate_single, o.rate_min, o.rate_max, o.as_of
    FROM org_network_rates o
    LEFT JOIN tin_registry t ON t.tin_norm = replace(replace(lower(o.tin), '-', ''), ' ', '')
    WHERE o.network_id = ${networkId} AND o.billing_code = ${billingCode}
    ORDER BY o.n_npis DESC, t.business_name NULLS LAST
    LIMIT ${limit}
  `) as Array<{
    tin: string;
    business_name: string | null;
    n_npis: number;
    n_rates: number;
    rate_single: string | null;
    rate_min: string;
    rate_max: string;
    as_of: string | Date | null;
  }>;
  return rows.map((r) => ({
    tin: r.tin,
    orgName: r.business_name,
    nNpis: Number(r.n_npis),
    nRates: Number(r.n_rates),
    rateSingle: r.rate_single,
    rateMin: r.rate_min,
    rateMax: r.rate_max,
    asOf: r.as_of ? isoDateOnly(r.as_of) : null,
  }));
}

/** Per-network priced-org counts for one code — annotates the /networks index. */
export async function networkOrgCounts(billingCode: string): Promise<Map<string, number>> {
  if (!hasDb) return new Map();
  const rows = (await sql`
    SELECT network_id, count(*)::int AS orgs
    FROM org_network_rates
    WHERE billing_code = ${billingCode}
    GROUP BY network_id
  `) as Array<{ network_id: string; orgs: number }>;
  return new Map(rows.map((r) => [r.network_id, Number(r.orgs)]));
}

export async function listNetworks(): Promise<NetworkListRow[]> {
  if (!hasDb) return [];
  const rows = (await sql`
    SELECT n.id, n.name, n.kind, n.administrator_id, n.notes,
           n.insurer_id, coalesce(i.name, n.insurer_id) AS insurer
    FROM networks n
    LEFT JOIN insurers i ON i.id = n.insurer_id
    ORDER BY insurer, n.name
  `) as Array<{
    id: string;
    name: string;
    kind: string;
    administrator_id: string | null;
    notes: string | null;
    insurer_id: string;
    insurer: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    insurer: r.insurer,
    insurerId: r.insurer_id,
    administrator: r.administrator_id || null,
    kind: r.kind,
    notes: r.notes,
  }));
}

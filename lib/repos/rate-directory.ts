import { hasDb, sql } from "@/lib/db";
import { networkParticipationForNpi, type AcceptingStatus } from "@/lib/repos/networks";

// Provider rate-directory repo — reads provider_rate_summary (sql/021, the
// pre-aggregated ~34k-row matview) joined to directory identity. Instant vs
// scanning the fact table. Powers the ranked, searchable provider table that
// replaces the empty NPI-search recruiting page. Own module (peer owns
// rate-signals.ts). Rates are per-session negotiated dollars, never revenue.

export interface RatedProvider {
  npi: string;
  name: string;
  profession: string | null;
  slug: string | null;
  payerCount: number;
  best90791: number | null;
  best90834: number | null;
  best90837: number | null;
  best90853: number | null;
  best99214: number | null;
  asOf: string | null;
}

const MOCK: RatedProvider[] = [
  { npi: "1649623984", name: "KISE MEGHAN", profession: "Psychiatric Nurse Practitioner", slug: null, payerCount: 8, best90791: 214.77, best90834: 145.45, best90837: 214.77, best90853: 63.45, best99214: 182.42, asOf: "2026-07-13" },
];

function map(r: Record<string, unknown>): RatedProvider {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    npi: r.npi as string,
    name: r.name as string,
    profession: (r.profession as string) ?? null,
    slug: (r.slug as string) ?? null,
    payerCount: Number(r.payer_count ?? 0),
    best90791: n(r.best_90791), best90834: n(r.best_90834), best90837: n(r.best_90837),
    best90853: n(r.best_90853), best99214: n(r.best_99214),
    asOf: r.as_of ? String(r.as_of).slice(0, 10) : null,
  };
}

// One provider's published rates, deduped for display. The standing endpoint
// (peer's rate-signals.ts) computes TIN cohorts + economics on top of this —
// far too heavy for the profile's compact table, which only needs the rows.
export interface ProviderRateRow {
  payer: string;
  network: string;
  billingCode: string;
  /** Pre-labeled dollar figure ("$140.90") — never a bare number. */
  figure: string;
  basis: string; // "Negotiated" | "Fee schedule" | "Derived" | …
  asOf: string | null; // YYYY-MM-DD
}

const BASIS: Record<string, string> = {
  negotiated: "Negotiated",
  "fee schedule": "Fee schedule",
  derived: "Derived",
  percentage: "Percentage",
  "per diem": "Per diem",
};

/** Every distinct (payer × network × code × rate) row for one NPI — collapses
 *  the per-plan duplication (Aetna ships the same rate row per employer plan). */
export async function listProviderRates(npi: string): Promise<ProviderRateRow[]> {
  if (!hasDb) return [];
  const rows = (await sql`
    SELECT payer, plan_or_network, billing_code, negotiated_type,
           negotiated_rate, max(as_of) AS as_of
    FROM provider_rate_signals
    WHERE npi = ${npi}
    GROUP BY payer, plan_or_network, billing_code, negotiated_type, negotiated_rate
    ORDER BY payer, plan_or_network, billing_code, negotiated_rate
  `) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    payer: r.payer as string,
    network: (r.plan_or_network as string) ?? "",
    billingCode: r.billing_code as string,
    figure: `$${Number(r.negotiated_rate).toFixed(2)}`,
    basis: BASIS[String(r.negotiated_type ?? "").toLowerCase()] ?? String(r.negotiated_type ?? "—"),
    asOf: r.as_of ? String(r.as_of instanceof Date ? r.as_of.toISOString() : r.as_of).slice(0, 10) : null,
  }));
}

// ── unified network membership ───────────────────────────────────────────────
// Both federal disclosures assert the same fact — membership in a network.
// The payer's directory adds accepting + as-of; the price file adds rates.
// One row per (payer × network), outer-joined across the two sources. Rows
// merge ONLY on exact payer+network match (case/whitespace-normalized) —
// never fuzzy: the vocabularies differ per source until the canonical
// network-entity crosswalk exists (Linear). Missing side renders null.

export interface NetworkMembershipRow {
  payer: string;
  /** "" = coarse bare listing (payer publishes presence without a network name). */
  network: string;
  /** null = rates-only row (no directory listing — NOT "not accepting"). */
  accepting: AcceptingStatus | null;
  asOf: string | null; // directory as-of when listed, else latest rate as-of
  /** Best per-session rate within this network per scanned code, pre-labeled. */
  best90791: string | null; // intake evaluation
  best90834: string | null; // 45-minute psychotherapy
  best90837: string | null; // 60-minute psychotherapy
  best90853: string | null; // group psychotherapy
  best99214: string | null; // med management, established
  source: "directory" | "rates" | "both";
}

const HEADLINE_CODES: Record<string, "best90791" | "best90834" | "best90837" | "best90853" | "best99214"> = {
  "90791": "best90791",
  "90834": "best90834",
  "90837": "best90837",
  "90853": "best90853",
  "99214": "best99214",
};

export async function listNetworkMemberships(npi: string, prefetchedRates?: ProviderRateRow[]): Promise<NetworkMembershipRow[]> {
  const [participation, rates] = await Promise.all([
    networkParticipationForNpi(npi),
    prefetchedRates ? Promise.resolve(prefetchedRates) : listProviderRates(npi),
  ]);
  const key = (payer: string, network: string) => `${payer.trim().toLowerCase()}|${network.trim().toLowerCase()}`;

  const map = new Map<string, NetworkMembershipRow>();
  for (const p of participation) {
    map.set(key(p.payer, p.network), {
      payer: p.payer,
      network: p.network,
      accepting: p.accepting,
      asOf: p.asOf ? p.asOf.slice(0, 10) : null,
      best90791: null,
      best90834: null,
      best90837: null,
      best90853: null,
      best99214: null,
      source: "directory",
    });
  }
  for (const r of rates) {
    const k = key(r.payer, r.network);
    let row = map.get(k);
    if (!row) {
      row = {
        payer: r.payer,
        network: r.network,
        accepting: null,
        asOf: r.asOf,
        best90791: null,
        best90834: null,
        best90837: null,
        best90853: null,
        best99214: null,
        source: "rates",
      };
      map.set(k, row);
    } else if (row.source === "directory") {
      row.source = "both"; // directory as-of wins — it's the liveness claim
    }
    const slot = HEADLINE_CODES[r.billingCode];
    if (slot) {
      const next = Number(r.figure.slice(1));
      const cur = row[slot] ? Number(row[slot]!.slice(1)) : -Infinity;
      if (next > cur) row[slot] = r.figure;
    }
    if (row.source === "rates" && r.asOf && (!row.asOf || r.asOf > row.asOf)) row.asOf = r.asOf;
  }
  return [...map.values()].sort((a, b) => a.payer.localeCompare(b.payer) || a.network.localeCompare(b.network));
}

/** Batch best-rate summary for a page of directory NPIs (matview point-reads,
 *  instant). Absent from the map = no published rates on file. */
export async function rateSummariesByNpi(
  npis: Array<string | null | undefined>,
): Promise<Map<string, { best90837: number | null; payerCount: number }>> {
  const ids = [...new Set(npis.filter((n): n is string => !!n))];
  if (!hasDb || ids.length === 0) return new Map();
  const rows = (await sql`
    SELECT npi, best_90837, payer_count FROM provider_rate_summary WHERE npi = ANY(${ids})
  `) as Array<{ npi: string; best_90837: unknown; payer_count: unknown }>;
  return new Map(
    rows.map((r) => [
      r.npi,
      { best90837: r.best_90837 == null ? null : Number(r.best_90837), payerCount: Number(r.payer_count ?? 0) },
    ]),
  );
}

/** Top rated providers, ranked by payer breadth then best 60-min rate. The
 *  directory ships a generous default set that the UI filters client-side. */
export async function listRatedProviders(limit = 500): Promise<RatedProvider[]> {
  if (!hasDb) return MOCK;
  const rows = (await sql`
    SELECT s.npi, d.name, d.profession, d.slug, s.payer_count,
           s.best_90791, s.best_90834, s.best_90837, s.best_90853, s.best_99214, s.as_of
    FROM provider_rate_summary s
    JOIN LATERAL (
      SELECT name, profession, slug FROM directory_providers dp
      WHERE dp.npi = s.npi AND dp.name IS NOT NULL
      ORDER BY (dp.source = 'nppes') DESC, dp.slug IS NOT NULL DESC LIMIT 1
    ) d ON true
    ORDER BY s.payer_count DESC, s.best_90837 DESC NULLS LAST
    LIMIT ${limit}
  `) as Array<Record<string, unknown>>;
  return rows.map(map);
}

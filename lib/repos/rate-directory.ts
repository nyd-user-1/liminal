import { hasDb, sql } from "@/lib/db";

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

import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";

// Public marketing aggregate reads — PHI-free corpus counts and the aggregate
// 90837 payer-median spread that the rate-intelligence marketing family
// (/pricing-data, /payer-negotiation, /payer-disputes) leads with. NEW file,
// deliberately narrow: NOTHING here touches clients, appointments, notes, or a
// specific plan × provider × code answer — only providers / orgs / payers /
// canonical entities / aggregate rate bands (the NYS-134 public scope).
//
// Two rules govern this module:
//   1. Every read is `hasDb`-guarded and try/catch → null|[] so a marketing
//      page degrades to a placeholder rather than throwing when a table is
//      absent (offline dev, a not-yet-built matview).
//   2. Counts drift nightly, so pages fetch these live at request time and
//      NEVER hardcode a figure. The figures are the credibility.
//
// Performance: the fact table (provider_rate_signals, ~13.6M rows) is counted
// via pg_class.reltuples — an ANALYZE-backed estimate that returns in ~200ms,
// where an exact count(*) scans for ~15s. It's rendered as "13.6M+", so an
// estimate is both fast and honest. Every other count is small and exact.

export interface CorpusStats {
  /** Payer-attested in-network rate rows on file (estimate; rendered "N+"). */
  attestedRates: number | null;
  /** Distinct clinicians in the statewide behavioral directory (active). */
  clinicians: number | null;
  /** Distinct billing organizations (TINs) seen across the rate corpus. */
  billingOrgs: number | null;
  /** Canonical insurers resolved from the NY DFS registry (sql/042–043). */
  insurers: number | null;
  /** Canonical networks (sql/044). */
  networks: number | null;
  /** Federal plan filings — DOL Form 5500 (sql/040). */
  planFilings: number | null;
}

async function scalar(run: () => Promise<Array<{ n: number | string }>>): Promise<number | null> {
  try {
    const rows = await run();
    const n = rows[0]?.n;
    return n == null ? null : Number(n);
  } catch {
    return null; // table/matview not present — degrade to a placeholder
  }
}

/**
 * The corpus-scale headline numbers, fetched live and in parallel. Any single
 * read failing yields null for that stat only; the band renders the rest.
 */
export async function getCorpusStats(): Promise<CorpusStats> {
  if (!hasDb) {
    return {
      attestedRates: null,
      clinicians: null,
      billingOrgs: null,
      insurers: null,
      networks: null,
      planFilings: null,
    };
  }

  const [attestedRates, clinicians, billingOrgs, insurers, networks, planFilings] = await Promise.all([
    // reltuples estimate — fast on the 13.6M-row fact table (see header note).
    scalar(
      async () =>
        (await sql`SELECT reltuples::bigint AS n FROM pg_class WHERE relname = 'provider_rate_signals'`) as Array<{
          n: string;
        }>,
    ),
    scalar(
      async () =>
        (await sql`SELECT count(*)::int AS n FROM directory_providers WHERE deactivated_at IS NULL`) as Array<{
          n: number;
        }>,
    ),
    scalar(async () => (await sql`SELECT count(DISTINCT tin)::int AS n FROM org_tin_rosters`) as Array<{ n: number }>),
    scalar(async () => (await sql`SELECT count(*)::int AS n FROM insurers`) as Array<{ n: number }>),
    scalar(async () => (await sql`SELECT count(*)::int AS n FROM networks`) as Array<{ n: number }>),
    scalar(async () => (await sql`SELECT count(*)::int AS n FROM form5500_filings`) as Array<{ n: number }>),
  ]);

  return { attestedRates, clinicians, billingOrgs, insurers, networks, planFilings };
}

// ── the 90837 payer-median spread ─────────────────────────────────────────────
// Aggregate market intelligence (the NYS-35 lane): the payer's OWN published
// in-network median for individual psychotherapy (CPT 90837, 60 min) across
// every NY behavioral book that prices it. This is NOT a plan × provider × code
// answer — it is the market band, which the honesty rules permit here. Reads the
// sql/024 precomputed matview (rate_bands_payer_summary), already deduped and
// NY-book scoped, never the 13.6M-row fact table.

export interface PayerMedianRow {
  payer: string;
  /** Formatted median, e.g. "$377.62". The consuming column header carries the
   *  "payer-published in-network rate" qualifier; as-of rides in its own column. */
  median: string;
  /** ISO date the band is good as of (max as_of among the payer's 90837 rows). */
  asOf: string;
  /** Distinct clinicians behind the band — evidence weight, not a rate. */
  clinicians: number;
  /** Median as a share of the highest median in the set (1–100) — drives the
   *  proportional bar only. The dollar figure is the disclosed value; this is a
   *  visual proportion, never a second rate. */
  barPct: number;
}

export interface PayerSpread {
  code: string;
  codeLabel: string;
  rows: PayerMedianRow[];
  /** Max as-of across the set — the "as of {date}" the surface stamps once. */
  asOf: string | null;
}

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * The 90837 median across NY payer books, richest book first. `minClinicians`
 * keeps thin books out (default 25, matching the rate module's floor). Empty on
 * any failure or offline — the page shows a quiet fallback rather than a fake
 * spread.
 */
export async function get90837Spread(opts: { minClinicians?: number } = {}): Promise<PayerSpread> {
  const code = "90837";
  const codeLabel = "Individual psychotherapy, 60 min";
  const empty: PayerSpread = { code, codeLabel, rows: [], asOf: null };
  if (!hasDb) return empty;

  const minClinicians = opts.minClinicians ?? 25;
  try {
    const rows = (await sql`
      SELECT payer, median, npis, as_of
      FROM rate_bands_payer_summary
      WHERE billing_code = ${code} AND npis >= ${minClinicians}
      ORDER BY median DESC
    `) as Array<{ payer: string; median: number; npis: number; as_of: string | Date }>;
    if (!rows.length) return empty;

    const maxMedian = Number(rows[0].median) || 1;
    let maxAsOf = "";
    const out: PayerMedianRow[] = rows.map((r) => {
      const asOf = isoDateOnly(r.as_of) ?? "";
      if (asOf > maxAsOf) maxAsOf = asOf;
      return {
        payer: r.payer,
        median: money(Number(r.median)),
        asOf,
        clinicians: Number(r.npis),
        barPct: Math.max(6, Math.round((Number(r.median) / maxMedian) * 100)),
      };
    });
    return { code, codeLabel, rows: out, asOf: maxAsOf || null };
  } catch {
    return empty;
  }
}

/** 13666980 → "13.6M", 150635 → "150K", 33227 → "33K", 47 → "47". Floors to the
 *  unit so pages can append "+" and stay honest (there really are MORE than the
 *  shown figure). A compact formatter for the corpus band. */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${Math.floor(n / 100_000) / 10}M`.replace(".0M", "M");
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return `${n}`;
}

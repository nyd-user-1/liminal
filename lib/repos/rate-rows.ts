import { CPT_LABELS } from "@/lib/cpt-labels.generated";
import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";

// Rate ROWS — the Services tab's read (NYS-93). One row per service: what the
// payer actually published, not a percentile over other people's rows.
//
// A NEW file on purpose. lib/repos/rate-signals.ts is another session's tonight
// and answers a different question (bands = aggregate cohorts); this reads the
// leaves. The slight overlap is accepted — the grains are genuinely different.
//
// SOURCE: rate_service_rows_mv (sql/063) — never provider_rate_signals, the
// 13.7M-row fact table. That matview IS the one-row-per-service grain, so the
// CROSS JOIN LATERAL (VALUES …) unpivot this query used to carry is gone.
//
// WHY IT MOVED OFF sql/032 (NYS-50). rate_table_child_mv is PIVOTED and pivots
// exactly five codes (c90791…c99214), so fifteen of the twenty codes we price
// could not be reached from here at all — no filter or picker could surface
// what the matview had no column for. sql/063 is the long-grain twin over all
// twenty; 032 stays as-is for its four other consumers (/published-rates,
// analytics, metrics, the admin inventory).
//
// WHAT THIS DOES NOT HAVE, and why (all measured — see NYS-93):
//   • No employer "plan". `plans` is Aetna-only; this matview excludes Aetna by
//     design (sql/027:60-64). The only join key (source_file) is on neither
//     matview and is many:many (up to 499 plans per file). `network` below IS
//     the plan/network the payer published — that is the plan column.
//   • No Flat/Group schedule badge. That is p25===p75 off the AGGREGATE bands
//     (sql/024); a leaf row has no p25/p75. `nRates > 1` is the honest signal:
//     the payer published several rates for this exact cell (NYS-64).
//
// COVERAGE: the matview holds billing IDs with <=400 leaves for that payer —
// the platform-scale TINs are excluded and live on /orgs. Callers must not
// claim completeness. (sql/063 documents why the cap is 400 and not 032's 100:
// re-applying 100 to the twenty-code leaf set would have evicted 9,616 rows
// that /rates lists today.)

/** Every code we price, straight off the generated cpt_codes map — never a
 *  second hardcoded list. Ascending code order IS the display order. */
export const RATE_ROW_CODES: readonly string[] = Object.keys(CPT_LABELS).sort();
export type RateRowCode = string;

export interface RateRow {
  npi: string;
  /** NPPES-cased; the UI formats it (providerDisplayName). */
  displayName: string | null;
  credential: string | null;
  profession: string | null;
  city: string | null;
  payer: string;
  /** plan_or_network — the payer's own product. THIS is the "plan" column. */
  network: string;
  /** place_of_service, raw ("11", "22", "CSTM-00"). UI labels it. */
  setting: string;
  tin: string;
  billingCode: string;
  /** The published rate. Null only when nRates > 1 (see below) — never a 0. */
  rate: number | null;
  /** Distinct rates the payer published for this cell. >1 ⇒ rate is null. */
  nRates: number;
  /** The spread when nRates > 1 (sql/065): for n=2 these ARE the two rates. */
  minRate: number | null;
  maxRate: number | null;
  asOf: string | null;
}

export interface RateRowFilters {
  /** Free text over clinician name, payer, network, TIN, NPI. */
  q?: string;
  payer?: string;
  code?: RateRowCode;
  network?: string;
  limit?: number;
  offset?: number;
}

/**
 * Server-paginated services list. Returns the page plus the full match count.
 *
 * The count and the page are TWO queries fired in parallel (Promise.all), not one
 * `count(*) OVER ()` (NYS-114, measured on the live 425k-service corpus): the
 * window forced Postgres to materialize + count every matching row before the
 * LIMIT could take 50, so the UNFILTERED initial load — the /rates first paint —
 * paid ~600 ms (1.2 s cold) even though it returns a page. Split apart, the page
 * is a top-N over the grain index (~145 ms) and the count runs beside it, so the
 * wall time is the slower of the two (~165 ms unfiltered; ~90 ms once the trigram
 * index in sql/060 filters display_name). A text/facet filter shrinks both.
 *
 * The count is skipped entirely past the first page: "load more" (offset > 0)
 * reuses the total the client already holds, so an infinite scroll never re-pays
 * the count.
 */
export async function listRateRows(
  f: RateRowFilters = {},
): Promise<{ rows: RateRow[]; total: number }> {
  if (!hasDb) return { rows: [], total: 0 };
  const limit = Math.min(f.limit ?? 50, 500);
  const offset = Math.max(f.offset ?? 0, 0);
  // Lowered here because search_text is stored lowered — that lets the trigram
  // index serve a plain LIKE instead of an ILIKE.
  const q = f.q?.trim() ? `%${f.q.trim().toLowerCase()}%` : null;
  const payer = f.payer ?? null;
  const code = f.code ?? null;
  const network = f.network ?? null;

  const pagePromise = sql`
    SELECT u.npi, u.display_name, u.credential, u.profession, u.city,
           u.payer, u.network, u.setting, u.tin, u.as_of,
           u.billing_code, u.rate, u.n_rates, u.min_rate, u.max_rate
    FROM rate_service_rows_mv u
    WHERE (${payer}::text IS NULL OR u.payer = ${payer})
      AND (${code}::text IS NULL OR u.billing_code = ${code})
      AND (${network}::text IS NULL OR u.network = ${network})
      -- One pre-lowered haystack (sql/063 search_text) covering clinician name,
      -- insurer, network, billing ID and NPI. The five-column OR this replaced
      -- could not use a trigram index and seq-scanned the whole matview.
      AND (${q}::text IS NULL OR u.search_text LIKE ${q})
    ORDER BY u.payer, u.network, u.billing_code, u.rate DESC NULLS LAST, u.npi
    LIMIT ${limit} OFFSET ${offset}
  ` as unknown as Promise<Array<Record<string, unknown>>>;

  // Only page 0 needs the count; scroll pages reuse it.
  const countPromise =
    offset === 0
      ? (sql`
          SELECT count(*)::int AS total
          FROM rate_service_rows_mv u
          WHERE (${payer}::text IS NULL OR u.payer = ${payer})
            AND (${code}::text IS NULL OR u.billing_code = ${code})
            AND (${network}::text IS NULL OR u.network = ${network})
            AND (${q}::text IS NULL OR (
                  u.display_name ILIKE ${q} OR u.payer ILIKE ${q} OR u.network ILIKE ${q}
                  OR u.tin ILIKE ${q} OR u.npi ILIKE ${q}))
        ` as unknown as Promise<Array<{ total: number }>>)
      : Promise.resolve([{ total: 0 }] as Array<{ total: number }>);

  const [rows, countRows] = await Promise.all([pagePromise, countPromise]);

  return {
    total: countRows[0]?.total ?? 0,
    rows: rows.map((r) => ({
      npi: r.npi as string,
      displayName: (r.display_name as string) ?? null,
      credential: (r.credential as string) ?? null,
      profession: (r.profession as string) ?? null,
      city: (r.city as string) ?? null,
      payer: r.payer as string,
      network: r.network as string,
      setting: r.setting as string,
      tin: r.tin as string,
      billingCode: r.billing_code as string,
      rate: r.rate == null ? null : Number(r.rate),
      nRates: Number(r.n_rates),
      minRate: r.min_rate == null ? null : Number(r.min_rate),
      maxRate: r.max_rate == null ? null : Number(r.max_rate),
      // Neon hands back Date objects; repos return ISO strings.
      asOf: r.as_of ? isoDateOnly(r.as_of as string) : null,
    })),
  };
}

/** The facet values actually present, so a filter never offers an empty result. */
export async function rateRowFacets(): Promise<{ payers: string[]; networks: string[] }> {
  if (!hasDb) return { payers: [], networks: [] };
  // A skip-scan, not a DISTINCT. There are 37 (payer, network) pairs in 1.09M
  // rows, and `SELECT DISTINCT` reads every one of them to find those 37 —
  // measured 149 ms (Parallel Seq Scan + HashAggregate), which made this the
  // slowest leg of the Services first paint even though it returns 37 rows.
  // Postgres has no loose index scan, so this walks idx_rsr_order's (payer,
  // network) prefix one pair at a time: 37 index probes instead of a full scan.
  const rows = (await sql`
    WITH RECURSIVE pairs AS (
      (SELECT payer, network FROM rate_service_rows_mv ORDER BY payer, network LIMIT 1)
      UNION ALL
      SELECT n.payer, n.network
      FROM pairs p
      CROSS JOIN LATERAL (
        SELECT payer, network FROM rate_service_rows_mv
        WHERE (payer, network) > (p.payer, p.network)
        ORDER BY payer, network LIMIT 1
      ) n
    )
    SELECT payer, network FROM pairs ORDER BY payer, network
  `) as Array<{ payer: string; network: string }>;
  return {
    payers: [...new Set(rows.map((r) => r.payer))],
    networks: [...new Set(rows.map((r) => r.network))],
  };
}

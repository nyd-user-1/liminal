import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";

// Rate ROWS — the Services tab's read (NYS-93). One row per service: what the
// payer actually published, not a percentile over other people's rows.
//
// A NEW file on purpose. lib/repos/rate-signals.ts is another session's tonight
// and answers a different question (bands = aggregate cohorts); this reads the
// leaves. The slight overlap is accepted — the grains are genuinely different.
//
// SOURCE: rate_table_child_mv (sql/032) only — never provider_rate_signals, the
// 9.3M-row fact table. The matview is PIVOTED (c90791…c99214 as columns), so
// "one row per service" is an unpivot, done in SQL via a LATERAL VALUES so the
// LIMIT/OFFSET counts SERVICES, not cells.
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
// COVERAGE: the matview holds TINs with <=100 leaves for that payer — ~48% of
// all children (the big platform TINs, Headway largest) are excluded and live
// on /orgs. Callers must not claim completeness.

/** The five codes the matview pivots. Order is the display order. */
export const RATE_ROW_CODES = ["90791", "90834", "90837", "90853", "99214"] as const;
export type RateRowCode = (typeof RATE_ROW_CODES)[number];

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
  const q = f.q?.trim() ? `%${f.q.trim()}%` : null;
  const payer = f.payer ?? null;
  const code = f.code ?? null;
  const network = f.network ?? null;

  const pagePromise = sql`
    WITH unpivoted AS (
      SELECT m.npi, m.display_name, m.credential, m.profession, m.city,
             m.payer, m.network, m.setting, m.tin, m.as_of,
             v.billing_code, v.rate, v.n_rates
      FROM rate_table_child_mv m
      CROSS JOIN LATERAL (VALUES
        ('90791', m.c90791, m.n90791),
        ('90834', m.c90834, m.n90834),
        ('90837', m.c90837, m.n90837),
        ('90853', m.c90853, m.n90853),
        ('99214', m.c99214, m.n99214)
      ) AS v(billing_code, rate, n_rates)
      -- A cell the payer never priced is not a service row. n_rates > 0 keeps
      -- the multi-rate cells (rate IS NULL, n_rates > 1), which ARE facts.
      WHERE v.n_rates > 0
    )
    SELECT u.*
    FROM unpivoted u
    WHERE (${payer}::text IS NULL OR u.payer = ${payer})
      AND (${code}::text IS NULL OR u.billing_code = ${code})
      AND (${network}::text IS NULL OR u.network = ${network})
      AND (${q}::text IS NULL OR (
            u.display_name ILIKE ${q} OR u.payer ILIKE ${q} OR u.network ILIKE ${q}
            OR u.tin ILIKE ${q} OR u.npi ILIKE ${q}))
    ORDER BY u.payer, u.network, u.billing_code, u.rate DESC NULLS LAST, u.npi
    LIMIT ${limit} OFFSET ${offset}
  ` as unknown as Promise<Array<Record<string, unknown>>>;

  // Only page 0 needs the count; scroll pages reuse it.
  const countPromise =
    offset === 0
      ? (sql`
          WITH unpivoted AS (
            SELECT m.payer, m.network, m.tin, m.npi, m.display_name,
                   v.billing_code, v.n_rates
            FROM rate_table_child_mv m
            CROSS JOIN LATERAL (VALUES
              ('90791', m.n90791), ('90834', m.n90834), ('90837', m.n90837),
              ('90853', m.n90853), ('99214', m.n99214)
            ) AS v(billing_code, n_rates)
            WHERE v.n_rates > 0
          )
          SELECT count(*)::int AS total
          FROM unpivoted u
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
      // Neon hands back Date objects; repos return ISO strings.
      asOf: r.as_of ? isoDateOnly(r.as_of as string) : null,
    })),
  };
}

/** The facet values actually present, so a filter never offers an empty result. */
export async function rateRowFacets(): Promise<{ payers: string[]; networks: string[] }> {
  if (!hasDb) return { payers: [], networks: [] };
  const rows = (await sql`
    SELECT DISTINCT payer, network FROM rate_table_child_mv ORDER BY payer, network
  `) as Array<{ payer: string; network: string }>;
  return {
    payers: [...new Set(rows.map((r) => r.payer))],
    networks: [...new Set(rows.map((r) => r.network))],
  };
}

import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";
import type { RateTableData, RateTablePayer, RateTableRow } from "@/lib/rate-table";

// Published-rates repo (sql/027 rate_table_mv) — the /published-rates data
// layer. One row per (billing TIN, payer): what the insurer publishes it pays
// that entity for five behavioral-health codes.
//
// The page ships the WHOLE corpus for a payer and narrows it client-side, so
// this repo has exactly one read: `WHERE payer = $1`, no filters, no paging.
// Every constraint that makes these numbers true (professional-only,
// no percent-of-charge, single-rate resolution, the payer allowlist) lives in
// the matview — see the sql/027 header before changing anything here.
//
// Types + the payer allowlist live in lib/rate-table.ts (no db import) so the
// client table can share them; this module is server-only.

// Zero-env fixture — ten rows that mirror the real shape (named + unnamed, org +
// individual, blank cells) so the page renders without a database.
const MOCK_ROWS: RateTableRow[] = [
  { tin: "ein:853976267", displayName: "Orenda Psychiatry PLLC", entityKind: "organization", credential: null, credentialNorm: null, county: null, npis: ["1234567890", "1234567891"], nClinicians: 2, c90791: 285.0, c90834: 148.5, c90837: 172.25, c90853: null, c99214: 132.4 },
  { tin: "ein:262976526", displayName: "River Region Psychiatry", entityKind: "organization", credential: null, credentialNorm: null, county: null, npis: ["1234567892"], nClinicians: 6, c90791: 240.0, c90834: 120.0, c90837: 145.0, c90853: 48.0, c99214: 110.0 },
  { tin: "ein:842050464", displayName: "Culpepper Psychiatric Associates", entityKind: "organization", credential: null, credentialNorm: null, county: null, npis: [], nClinicians: 31, c90791: null, c90834: 118.75, c90837: 139.9, c90853: null, c99214: null },
  { tin: "ein:832675429", displayName: "New York Medical Behavioral Health Services (Headway NY)", entityKind: "organization", credential: null, credentialNorm: null, county: null, npis: [], nClinicians: 13614, c90791: 196.0, c90834: 98.0, c90837: 116.0, c90853: 39.0, c99214: null },
  { tin: "ein:900112233", displayName: "MARCUS LENA (individual)", entityKind: "individual", credential: "LCSW", credentialNorm: "LCSW", county: "Kings", npis: ["1598765432"], nClinicians: 1, c90791: 152.0, c90834: 79.5, c90837: 94.25, c90853: null, c99214: null },
  { tin: "ein:900112234", displayName: "HILARIO ANDRE (individual)", entityKind: "individual", credential: "PH.D.", credentialNorm: "PHD", county: "New York", npis: ["1598765433"], nClinicians: 1, c90791: 310.0, c90834: 165.0, c90837: 198.0, c90853: 62.0, c99214: null },
  { tin: "ein:900112235", displayName: "OKONKWO ADA (individual)", entityKind: "individual", credential: "LMHC", credentialNorm: "LMHC", county: "Queens", npis: ["1598765434"], nClinicians: 1, c90791: 138.0, c90834: 71.0, c90837: 84.0, c90853: null, c99214: null },
  { tin: "ein:900112236", displayName: "REYES SOFIA (individual)", entityKind: "individual", credential: "M.D.", credentialNorm: "MD", county: "Bronx", npis: ["1598765435"], nClinicians: 1, c90791: 402.0, c90834: null, c90837: 221.5, c90853: null, c99214: 168.0 },
  { tin: "ein:900112237", displayName: null, entityKind: "organization", credential: null, credentialNorm: null, county: null, npis: ["1598765436", "1598765437", "1598765438"], nClinicians: 3, c90791: null, c90834: 102.0, c90837: 124.0, c90853: null, c99214: null },
  { tin: "npi:1265047799", displayName: null, entityKind: "individual", credential: "PSY.D.", credentialNorm: "PSYD", county: "Erie", npis: ["1265047799"], nClinicians: 1, c90791: 175.0, c90834: 88.0, c90837: 105.0, c90853: null, c99214: null },
];

// One payer's corpus is ~12.5k rows / ~4MB of JSON, which Next's data cache
// REFUSES to store: unstable_cache (and any fetch cache entry) is hard-capped at
// 2MB per entry — over that it logs "items over 2MB can not be cached" and the
// rejection surfaces as a render error. So the 1h cache the page needs lives
// here instead, in-process, same shape as getCheckedBooks' checkedBooksCache in
// rate-signals.ts. The data only moves on ingest, so a per-process TTL is the
// right grain; a redeploy or an ingest-time restart drops it naturally.
const TTL_MS = 60 * 60 * 1000;
const cache = new Map<RateTablePayer, { at: number; data: RateTableData }>();

/** The full corpus for one payer. ~12.5k rows for Cigna — that IS the design:
 *  the reader finds their own row inside a table that was already fully visible. */
export async function getRateTable(payer: RateTablePayer): Promise<RateTableData> {
  const hit = cache.get(payer);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const data = await readRateTable(payer);
  cache.set(payer, { at: Date.now(), data });
  return data;
}

async function readRateTable(payer: RateTablePayer): Promise<RateTableData> {
  if (!hasDb) return { payer, rows: MOCK_ROWS, asOf: "2026-07-01" };

  const rows = (await sql`
    SELECT tin, display_name, entity_kind, credential, credential_norm, county,
           npis, n_clinicians,
           c90791::float8 AS c90791, c90834::float8 AS c90834, c90837::float8 AS c90837,
           c90853::float8 AS c90853, c99214::float8 AS c99214,
           as_of
    FROM rate_table_mv
    WHERE payer = ${payer}
  `) as Array<{
    tin: string;
    display_name: string | null;
    entity_kind: "individual" | "organization";
    credential: string | null;
    credential_norm: string | null;
    county: string | null;
    npis: string[];
    n_clinicians: number;
    c90791: number | null;
    c90834: number | null;
    c90837: number | null;
    c90853: number | null;
    c99214: number | null;
    as_of: string | Date | null;
  }>;

  // as_of is per (tin, payer) in the MV but the footer states one publication
  // date per payer — fold it here rather than shipping 12.5k identical dates.
  let asOf: string | null = null;
  const out: RateTableRow[] = rows.map((r) => {
    const d = r.as_of ? isoDateOnly(r.as_of) : null;
    if (d && (!asOf || d > asOf)) asOf = d;
    return {
      tin: r.tin,
      displayName: r.display_name,
      entityKind: r.entity_kind,
      credential: r.credential,
      credentialNorm: r.credential_norm,
      county: r.county,
      npis: r.npis ?? [],
      nClinicians: r.n_clinicians,
      c90791: r.c90791,
      c90834: r.c90834,
      c90837: r.c90837,
      c90853: r.c90853,
      c99214: r.c99214,
    };
  });
  return { payer, rows: out, asOf };
}

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
  { tin: "ein:853976267", payer: "Cigna Health & Life", displayName: "Orenda Psychiatry PLLC", entityKind: "organization", credential: null, credentialNorm: null, npis: ["1234567890", "1234567891"], nProviders: 2, unnamedNo: null, c90791: 285.0, c90834: 148.5, c90837: 172.25, c90853: null, c99214: 132.4, n90791: 1, n90834: 1, n90837: 1, n90853: 0, n99214: 1 },
  { tin: "ein:262976526", payer: "Cigna Health & Life", displayName: "River Region Psychiatry", entityKind: "organization", credential: null, credentialNorm: null, npis: ["1234567892"], nProviders: 6, unnamedNo: null, c90791: 240.0, c90834: 120.0, c90837: 145.0, c90853: 48.0, c99214: 110.0, n90791: 1, n90834: 1, n90837: 1, n90853: 1, n99214: 1 },
  { tin: "ein:842050464", payer: "Empire BlueCross BlueShield", displayName: "Culpepper Psychiatric Associates", entityKind: "organization", credential: null, credentialNorm: null, npis: [], nProviders: 31, unnamedNo: null, c90791: null, c90834: 118.75, c90837: 139.9, c90853: null, c99214: null, n90791: 0, n90834: 1, n90837: 1, n90853: 0, n99214: 0 },
  { tin: "ein:832675429", payer: "Oxford Health Insurance Inc", displayName: "New York Medical Behavioral Health Services (Headway NY)", entityKind: "organization", credential: null, credentialNorm: null, npis: [], nProviders: 13614, unnamedNo: null, c90791: 196.0, c90834: 98.0, c90837: 116.0, c90853: 39.0, c99214: null, n90791: 1, n90834: 1, n90837: 1, n90853: 1, n99214: 0 },
  { tin: "ein:900112233", payer: "Cigna Health & Life", displayName: "MARCUS LENA (individual)", entityKind: "individual", credential: "LCSW", credentialNorm: "LCSW", npis: ["1598765432"], nProviders: 1, unnamedNo: null, c90791: 152.0, c90834: 79.5, c90837: 94.25, c90853: null, c99214: null, n90791: 1, n90834: 1, n90837: 1, n90853: 0, n99214: 0 },
  { tin: "ein:900112234", payer: "EmblemHealth (Carelon behavioral)", displayName: "HILARIO ANDRE (individual)", entityKind: "individual", credential: "PH.D.", credentialNorm: "PHD", npis: ["1598765433"], nProviders: 1, unnamedNo: null, c90791: 310.0, c90834: 165.0, c90837: 198.0, c90853: 62.0, c99214: null, n90791: 1, n90834: 1, n90837: 1, n90853: 1, n99214: 0 },
  { tin: "ein:900112235", payer: "Fidelis Care (Centene)", displayName: "OKONKWO ADA (individual)", entityKind: "individual", credential: "LMHC", credentialNorm: "LMHC", npis: ["1598765434"], nProviders: 1, unnamedNo: null, c90791: 138.0, c90834: 71.0, c90837: 84.0, c90853: null, c99214: null, n90791: 1, n90834: 1, n90837: 1, n90853: 0, n99214: 0 },
  { tin: "ein:900112236", payer: "MetroPlus Health Plan", displayName: "REYES SOFIA (individual)", entityKind: "individual", credential: "M.D.", credentialNorm: "MD", npis: ["1598765435"], nProviders: 1, unnamedNo: null, c90791: 402.0, c90834: null, c90837: 221.5, c90853: null, c99214: 168.0, n90791: 1, n90834: 0, n90837: 1, n90853: 0, n99214: 1 },
  { tin: "ein:900112237", payer: "Cigna Health & Life", displayName: null, entityKind: "organization", credential: null, credentialNorm: null, npis: ["1598765436", "1598765437", "1598765438"], nProviders: 3, unnamedNo: null, c90791: null, c90834: 102.0, c90837: 124.0, c90853: null, c99214: null, n90791: 0, n90834: 1, n90837: 1, n90853: 0, n99214: 0 },
  { tin: "npi:1265047799", payer: "Cigna Health & Life", displayName: null, entityKind: "individual", credential: "PSY.D.", credentialNorm: "PSYD", npis: ["1265047799"], nProviders: 1, unnamedNo: null, c90791: 175.0, c90834: 88.0, c90837: 105.0, c90853: null, c99214: null, n90791: 1, n90834: 1, n90837: 1, n90853: 0, n99214: 0 },
];

// One payer's corpus is ~12.5k rows / ~4MB of JSON, which Next's data cache
// REFUSES to store: unstable_cache (and any fetch cache entry) is hard-capped at
// 2MB per entry — over that it logs "items over 2MB can not be cached" and the
// rejection surfaces as a render error. So the 1h cache the page needs lives
// here instead, in-process, same shape as getCheckedBooks' checkedBooksCache in
// rate-signals.ts. The data only moves on ingest, so a per-process TTL is the
// right grain; a redeploy or an ingest-time restart drops it naturally.
const TTL_MS = 60 * 60 * 1000;
let cache: { at: number; data: RateTableData } | null = null;

/** Every insurer's corpus in one read (38,716 rows). The page ships all of it
 *  and narrows client-side — insurer, entity type and credential are all filters
 *  over the loaded set, so there is exactly one query and one cache entry. */
export async function getRateTable(): Promise<RateTableData> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const data = await readRateTable();
  cache = { at: Date.now(), data };
  return data;
}

async function readRateTable(): Promise<RateTableData> {
  if (!hasDb) {
    return {
      rows: numberUnnamed(MOCK_ROWS),
      asOfByPayer: { "Cigna Health & Life": "2026-07-01", "MetroPlus Health Plan": "2024-02-07" },
    };
  }

  // The MVs only ever hold allowlist payers, so there is no predicate at all.
  // Two reads, one round trip each: the groups, then their clinicians.
  const rows = (await sql`
    SELECT tin, payer, display_name, entity_kind, credential, credential_norm,
           npis, n_clinicians,
           c90791::float8 AS c90791, c90834::float8 AS c90834, c90837::float8 AS c90837,
           c90853::float8 AS c90853, c99214::float8 AS c99214,
           n90791, n90834, n90837, n90853, n99214,
           as_of
    FROM rate_table_mv
  `) as Array<{
    tin: string;
    payer: RateTablePayer;
    display_name: string | null;
    entity_kind: "individual" | "organization";
    credential: string | null;
    credential_norm: string | null;
    npis: string[];
    n_clinicians: number;
    c90791: number | null;
    c90834: number | null;
    c90837: number | null;
    c90853: number | null;
    c99214: number | null;
    n90791: number;
    n90834: number;
    n90837: number;
    n90853: number;
    n99214: number;
    as_of: string | Date | null;
  }>;

  const kids = (await sql`
    SELECT tin, payer, npi, display_name, credential, credential_norm, profession, city, county,
           c90791::float8 AS c90791, c90834::float8 AS c90834, c90837::float8 AS c90837,
           c90853::float8 AS c90853, c99214::float8 AS c99214,
           n90791, n90834, n90837, n90853, n99214
    FROM rate_table_child_mv
  `) as Array<{
    tin: string;
    payer: RateTablePayer;
    npi: string;
    display_name: string | null;
    credential: string | null;
    credential_norm: string | null;
    profession: string | null;
    city: string | null;
    county: string | null;
    c90791: number | null;
    c90834: number | null;
    c90837: number | null;
    c90853: number | null;
    c99214: number | null;
    n90791: number;
    n90834: number;
    n90837: number;
    n90853: number;
    n99214: number;
  }>;

  // Children keyed by their parent's identity, so the map below is one lookup
  // per group rather than a scan per group.
  const childrenByKey = new Map<string, RateTableRow[]>();
  for (const k of kids) {
    const key = `${k.payer}::${k.tin}`;
    const row: RateTableRow = {
      tin: k.tin,
      payer: k.payer,
      // May be NULL, and that is survivable in a way a nameless GROUP is not:
      // the child still carries its NPI, so the row is findable and checkable.
      // This is why the group's name was never the blocker — the people are the
      // identity.
      displayName: k.display_name,
      entityKind: "individual",
      credential: k.credential,
      credentialNorm: k.credential_norm,
      profession: k.profession,
      city: k.city,
      npis: [k.npi],
      nProviders: 1,
      unnamedNo: null,
      c90791: k.c90791, c90834: k.c90834, c90837: k.c90837, c90853: k.c90853, c99214: k.c99214,
      n90791: k.n90791, n90834: k.n90834, n90837: k.n90837, n90853: k.n90853, n99214: k.n99214,
      isChild: true,
    };
    const list = childrenByKey.get(key);
    if (list) list.push(row);
    else childrenByKey.set(key, [row]);
  }

  // as_of is per (tin, payer) in the MV; fold to one date PER INSURER rather
  // than shipping 38k near-identical dates or — worse — one date for the table.
  const asOfByPayer: Partial<Record<RateTablePayer, string>> = {};
  const out: RateTableRow[] = rows.map((r) => {
    const d = r.as_of ? isoDateOnly(r.as_of) : null;
    if (d && (!asOfByPayer[r.payer] || d > asOfByPayer[r.payer]!)) asOfByPayer[r.payer] = d;
    const children = childrenByKey.get(`${r.payer}::${r.tin}`);
    return {
      tin: r.tin,
      payer: r.payer,
      displayName: r.display_name,
      entityKind: r.entity_kind,
      credential: r.credential,
      credentialNorm: r.credential_norm,
      npis: r.npis ?? [],
      nProviders: r.n_clinicians,
      unnamedNo: null,
      c90791: r.c90791,
      c90834: r.c90834,
      c90837: r.c90837,
      c90853: r.c90853,
      c99214: r.c99214,
      n90791: r.n90791,
      n90834: r.n90834,
      n90837: r.n90837,
      n90853: r.n90853,
      n99214: r.n99214,
      // Sorted by name so an opened group reads like a roster, not a dump.
      // Nameless children (no directory row) sink rather than heading the list.
      children: children?.sort((a, b) =>
        (a.displayName ?? "￿").localeCompare(b.displayName ?? "￿"),
      ),
    };
  });
  return { rows: numberUnnamed(out), asOfByPayer };
}

/**
 * "Unnamed practice 41" — a stable handle for a TIN whose name we don't hold.
 * Numbered per DISTINCT TIN in tin order, so one entity keeps one number across
 * every insurer it appears under, and the number doesn't shuffle between loads.
 * It's a label, not an identity: the TIN and NPI columns are the real keys, and
 * the number goes away for good once the MRF sidecar lands real names.
 */
function numberUnnamed(rows: RateTableRow[]): RateTableRow[] {
  const seq = new Map<string, number>();
  for (const tin of [...new Set(rows.filter((r) => !r.displayName).map((r) => r.tin))].sort())
    seq.set(tin, seq.size + 1);
  return rows.map((r) => (r.displayName ? r : { ...r, unnamedNo: seq.get(r.tin) ?? null }));
}

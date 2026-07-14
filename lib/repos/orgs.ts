import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";
import { formatTin, normTin } from "@/lib/repos/tin-registry";

// Organization workspace repo (sql/025, NYS-41). An "org" here is a billing
// TIN observed in provider_rate_signals — the contract-holding entity between
// providers and payers (Headway NY, Lifestance, hospital faculty practices).
// Names come from tin_registry (payer-roster attestations, never legal-entity
// lookups); rosters and economics come from the 025 matviews, so every
// function reads a few hundred precomputed rows, not the 9M-row fact table.
//
// Same display rules as rate-signals.ts: a rate is what the PAYER pays the
// PROVIDER, always shown with its as-of date; membership ≠ accepting/liveness.

export type OrgListRow = {
  tin: string;            // normalized ('ein:832675429')
  name: string | null;    // tin_registry name, null when unknown
  label: string;          // name ?? formatTin(tin) — always renderable
  npis: number;
  payerCount: number;
  lastFileDate: string | null; // ISO date
};

export type OrgHeader = {
  tin: string;
  name: string | null;
  label: string;
  nameSource: string | null; // tin_registry.source ('fhir-crosswalk:…', 'nppes-org', …)
  npis: number;
  payerCount: number;
  asOf: string | null;
  // NPI-2 identity when the TIN is an org NPI we hold in nppes_organizations
  nppes: {
    npi: string;
    otherName: string | null;
    taxonomy: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    authorizedOfficial: string | null;
  } | null;
};

export type OrgRateBand = {
  payer: string;
  billingCode: string;
  npis: number;
  p25: number | null;
  median: number | null;
  p75: number | null;
  minRate: number;
  maxRate: number;
  asOf: string; // ISO date — render as "in-network rate · as-of {date}"
};

export type OrgRosterRow = {
  npi: string;
  name: string | null;       // directory name when we know the provider
  profession: string | null;
  city: string | null;
  slug: string | null;       // directory profile link when available
  payerCount: number;
  lastFileDate: string | null;
};

export type OrgFhirName = { display: string; npis: number };

const MOCK_ORG: OrgListRow = {
  tin: "ein:832675429",
  name: "New York Medical Behavioral Health Services (Headway NY)",
  label: "New York Medical Behavioral Health Services (Headway NY)",
  npis: 13614,
  payerCount: 8,
  lastFileDate: "2026-07-01",
};

export type OrgListFilters = {
  q?: string;
  limit?: number;
  /** true = only orgs with a resolved name; false = only unnamed TINs. */
  named?: boolean;
  /** Only orgs appearing in this payer's rate book. */
  payer?: string;
  /** 'ein' = contract-holder EINs; 'npi' = orgs billing under their own NPI. */
  tinKind?: "ein" | "npi";
};

/** Top organizations by roster size; filtered by name/named/payer/TIN-kind. */
export async function listOrgs(opts: OrgListFilters = {}): Promise<OrgListRow[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const q = (opts.q ?? "").trim();
  const { named, payer, tinKind } = opts;
  if (!hasDb) {
    const okQ = !q || MOCK_ORG.name!.toLowerCase().includes(q.toLowerCase());
    const okNamed = named === undefined || named === !!MOCK_ORG.name;
    const okKind = !tinKind || MOCK_ORG.tin.startsWith(`${tinKind}:`);
    return okQ && okNamed && okKind && !payer ? [MOCK_ORG] : [];
  }
  // Dynamic WHERE over org_tin_rosters (grain: tin × npi) — several optional
  // filters, so parameterized query rather than the tagged template.
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`t.business_name ILIKE $${params.length}`);
  }
  if (named === true) where.push(`t.business_name IS NOT NULL`);
  if (named === false) where.push(`t.business_name IS NULL`);
  if (tinKind === "ein") where.push(`r.tin LIKE 'ein:%'`);
  if (tinKind === "npi") where.push(`r.tin LIKE 'npi:%'`);
  if (payer) {
    params.push(payer);
    where.push(`EXISTS (SELECT 1 FROM org_tin_rate_summary s2 WHERE s2.tin = r.tin AND s2.payer = $${params.length})`);
  }
  params.push(limit);
  const limitPh = `$${params.length}`;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = (await sql.query(
    `SELECT g.tin, g.name, g.npis, p.payer_count, g.last_file_date
     FROM (
       SELECT r.tin, t.business_name AS name,
              count(*)::int AS npis,
              max(r.last_file_date) AS last_file_date
       FROM org_tin_rosters r
       LEFT JOIN tin_registry t ON t.tin_norm = r.tin
       ${whereSql}
       GROUP BY r.tin, t.business_name
       ORDER BY count(*) DESC, r.tin
       LIMIT ${limitPh}
     ) g
     LEFT JOIN LATERAL (
       SELECT count(DISTINCT payer)::int AS payer_count
       FROM org_tin_rate_summary s WHERE s.tin = g.tin
     ) p ON true
     ORDER BY g.npis DESC, g.tin`,
    params,
  )) as Array<{ tin: string; name: string | null; npis: number; payer_count: number; last_file_date: Date | null }>;
  return rows.map((r) => ({
    tin: r.tin,
    name: r.name,
    label: r.name ?? formatTin(r.tin),
    npis: r.npis,
    payerCount: r.payer_count,
    lastFileDate: r.last_file_date ? isoDateOnly(r.last_file_date) : null,
  }));
}

/** Filter-chip options for the /orgs toolbar: the payer books orgs appear in. */
export async function orgFacets(): Promise<{ payers: string[] }> {
  if (!hasDb) return { payers: ["Oxford Health Insurance Inc", "Aetna Life Insurance Company"] };
  const rows = (await sql`
    SELECT DISTINCT payer FROM org_tin_rate_summary ORDER BY payer
  `) as Array<{ payer: string }>;
  return { payers: rows.map((r) => r.payer) };
}

/** Header block for one org: identity + roster/payer counts (+ NPI-2 record). */
export async function getOrgHeader(tin: string): Promise<OrgHeader | null> {
  const key = normTin(tin);
  if (!hasDb) {
    if (key !== MOCK_ORG.tin) return null;
    return { tin: key, name: MOCK_ORG.name, label: MOCK_ORG.label, nameSource: "mock",
             npis: MOCK_ORG.npis, payerCount: MOCK_ORG.payerCount, asOf: "2026-07-13", nppes: null };
  }
  const rows = (await sql`
    SELECT count(*)::int AS npis,
           (SELECT count(DISTINCT payer) FROM org_tin_rate_summary WHERE tin = ${key})::int AS payer_count,
           max(as_of) AS as_of
    FROM org_tin_rosters WHERE tin = ${key}
  `) as Array<{ npis: number; payer_count: number; as_of: Date | null }>;
  if (!rows[0] || rows[0].npis === 0) return null;
  const nameRows = (await sql`
    SELECT business_name, source FROM tin_registry WHERE tin_norm = ${key}
  `) as Array<{ business_name: string; source: string }>;
  const npi2 = key.startsWith("npi:") ? key.slice(4) : null;
  const nppesRows = npi2
    ? ((await sql`
        SELECT npi, other_name, taxonomy, address, city, state, authorized_official
        FROM nppes_organizations WHERE npi = ${npi2}
      `) as Array<{ npi: string; other_name: string | null; taxonomy: string | null; address: string | null; city: string | null; state: string | null; authorized_official: string | null }>)
    : [];
  const name = nameRows[0]?.business_name ?? null;
  return {
    tin: key,
    name,
    label: name ?? formatTin(key),
    nameSource: nameRows[0]?.source ?? null,
    npis: rows[0].npis,
    payerCount: rows[0].payer_count,
    asOf: rows[0].as_of ? isoDateOnly(rows[0].as_of) : null,
    nppes: nppesRows[0]
      ? {
          npi: nppesRows[0].npi,
          otherName: nppesRows[0].other_name,
          taxonomy: nppesRows[0].taxonomy,
          address: nppesRows[0].address,
          city: nppesRows[0].city,
          state: nppesRows[0].state,
          authorizedOfficial: nppesRows[0].authorized_official,
        }
      : null,
  };
}

/** Per-insurer economics: every (payer, code) band the TIN appears in. */
export async function getOrgRates(tin: string): Promise<OrgRateBand[]> {
  const key = normTin(tin);
  if (!hasDb)
    return key === MOCK_ORG.tin
      ? [{ payer: "Oxford Health Insurance Inc", billingCode: "90837", npis: 3250,
           p25: 137.78, median: 137.78, p75: 137.78, minRate: 110.22, maxRate: 172.22, asOf: "2026-07-13" }]
      : [];
  const rows = (await sql`
    SELECT payer, billing_code, npis, p25, median, p75, min_rate, max_rate, as_of
    FROM org_tin_rate_summary
    WHERE tin = ${key}
    ORDER BY npis DESC, payer, billing_code
  `) as Array<{ payer: string; billing_code: string; npis: number; p25: number | null; median: number | null; p75: number | null; min_rate: number; max_rate: number; as_of: Date }>;
  return rows.map((r) => ({
    payer: r.payer,
    billingCode: r.billing_code,
    npis: r.npis,
    p25: r.p25,
    median: r.median,
    p75: r.p75,
    minRate: r.min_rate,
    maxRate: r.max_rate,
    asOf: isoDateOnly(r.as_of),
  }));
}

/** Roster page: the TIN's NPIs, enriched from the directory when we know them. */
export async function getOrgRoster(
  tin: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ total: number; rows: OrgRosterRow[] }> {
  const key = normTin(tin);
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  if (!hasDb) return { total: 0, rows: [] };
  const totalRows = (await sql`
    SELECT count(*)::int AS n FROM org_tin_rosters WHERE tin = ${key}
  `) as Array<{ n: number }>;
  const rows = (await sql`
    SELECT r.npi, r.payer_count, r.last_file_date,
           d.name, d.profession, d.city, d.slug
    FROM org_tin_rosters r
    LEFT JOIN LATERAL (
      SELECT name, profession, city, slug FROM directory_providers
      WHERE npi = r.npi ORDER BY (source = 'medicaid') DESC LIMIT 1
    ) d ON true
    WHERE r.tin = ${key}
    ORDER BY (d.name IS NULL), d.name, r.npi
    LIMIT ${limit} OFFSET ${offset}
  `) as Array<{ npi: string; payer_count: number; last_file_date: Date | null; name: string | null; profession: string | null; city: string | null; slug: string | null }>;
  return {
    total: totalRows[0]?.n ?? 0,
    rows: rows.map((r) => ({
      npi: r.npi,
      name: r.name,
      profession: r.profession,
      city: r.city,
      slug: r.slug,
      payerCount: r.payer_count,
      lastFileDate: r.last_file_date ? isoDateOnly(r.last_file_date) : null,
    })),
  };
}

/** Distinct names payers publish for this TIN's roster (the "Related" list).
 *  Case/punctuation-insensitive dedup so "HEADWAY" and "Headway" collapse to
 *  one entry with a distinct-NPI count across all its spellings and payers; the
 *  representative display prefers a mixed-case, shortest spelling. Payer is
 *  intentionally not returned — the list shows the name + clinician count only. */
export async function getOrgFhirNames(tin: string): Promise<OrgFhirName[]> {
  const key = normTin(tin);
  if (!hasDb) return [];
  const rows = (await sql`
    SELECT display, npis FROM (
      SELECT
        (array_agg(display ORDER BY (display ~ '[a-z]') DESC, length(display) ASC, display ASC))[1] AS display,
        count(DISTINCT npi)::int AS npis
      FROM (
        SELECT a.npi, a.org_display AS display,
               upper(regexp_replace(a.org_display, '[^a-zA-Z0-9]', '', 'g')) AS norm
        FROM org_tin_rosters r
        JOIN org_affiliations a ON a.npi = r.npi
        WHERE r.tin = ${key}
      ) x
      GROUP BY norm
    ) y
    ORDER BY npis DESC
    LIMIT 12
  `) as Array<{ display: string; npis: number }>;
  return rows;
}

export type OrgParticipationRow = {
  payer: string;
  network: string;
  npis: number;
  accepting: number; // accepting-new-patients (directory-listed) — liveness, not membership
};

/** Directory-corroborated network membership for the TIN's roster. Heavier
 *  than the matview reads (joins live participation) — render inside a
 *  Suspense boundary. */
export async function getOrgParticipation(tin: string): Promise<OrgParticipationRow[]> {
  const key = normTin(tin);
  if (!hasDb) return [];
  const rows = (await sql`
    SELECT ps.name AS payer, pn.network_name AS network,
           count(DISTINCT p.npi)::int AS npis,
           count(DISTINCT p.npi) FILTER (WHERE p.accepting_new_patients = 'accepting')::int AS accepting
    FROM org_tin_rosters r
    JOIN provider_network_participation p ON p.npi = r.npi
    JOIN payer_networks pn ON pn.id = p.network_id
    JOIN payer_sources ps ON ps.id = p.payer_source_id
    WHERE r.tin = ${key}
    GROUP BY ps.name, pn.network_name
    ORDER BY count(DISTINCT p.npi) DESC
    LIMIT 30
  `) as Array<{ payer: string; network: string; npis: number; accepting: number }>;
  return rows;
}

/** Which orgs an NPI bills under — the provider-profile side of the link. */
export async function getOrgsForNpi(npi: string): Promise<OrgListRow[]> {
  if (!hasDb) return [];
  const rows = (await sql`
    SELECT r.tin, t.business_name AS name, s.npis, r.payer_count, r.last_file_date
    FROM org_tin_rosters r
    LEFT JOIN tin_registry t ON t.tin_norm = r.tin
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS npis FROM org_tin_rosters WHERE tin = r.tin
    ) s ON true
    WHERE r.npi = ${npi}
    ORDER BY s.npis DESC
  `) as Array<{ tin: string; name: string | null; npis: number; payer_count: number; last_file_date: Date | null }>;
  return rows.map((r) => ({
    tin: r.tin,
    name: r.name,
    label: r.name ?? formatTin(r.tin),
    npis: r.npis,
    payerCount: r.payer_count,
    lastFileDate: r.last_file_date ? isoDateOnly(r.last_file_date) : null,
  }));
}

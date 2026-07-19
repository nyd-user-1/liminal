import { hasDb, sql } from "@/lib/db";
import { isoDateOnly, isoDateTime } from "@/lib/format";
import { RATE_CODES } from "@/lib/rate-table";
import { TABLE_GROUPS } from "@/lib/table-atlas.mjs";

// admin.ts — the platform's ONE table registry: what every table is, what it
// links to, which page it powers, and its live count. Two consumers read it:
// the founder-only /admin/data dictionary (full schema reference) and the
// /dashboard observatory (the same rows as cards). They share one memo — see
// platformInventory() — so adding a table here lands in both places at once.
//
// The whole inventory is three round trips, not one-per-table: one pg_class
// probe (existence + estimates), one batched exact-count query, one aggregate
// flight for the facts that aren't row counts. A cold load pays for them once;
// every load inside the TTL is free.

export interface DictionaryFact {
  label: string;
  value: string;
}

export interface DictionaryTable {
  /** Table or matview name, rendered mono. */
  name: string;
  /** Live row count; null in mock mode, when the table is missing, or on planned rows ("—"). */
  count: number | null;
  /** "estimate" tables use the pg_class planner estimate (≈), never exact count(*). */
  countKind: "exact" | "estimate";
  meaning: string;
  links: string;
  /** Present only on planned/gap rows — the Linear ref shown in place of a count. */
  planned?: string;
  /** Observatory: one-line plain-language gloss. Falls back to `meaning`. */
  blurb?: string;
  /** Observatory: the page this table powers. */
  powers?: { href: string; label: string };
  /** Observatory: live facts that aren't row counts (distinct NPIs, % named…). */
  facts?: DictionaryFact[];
  /** to_regclass found nothing — the loader hasn't run yet. Renders "not yet loaded". */
  missing?: boolean;
}

export interface DictionaryGroup {
  title: string;
  /** Observatory: what this whole group is, in one line. */
  blurb?: string;
  /** False for the EHR group — the observatory is the data platform, not the practice. */
  platform: boolean;
  tables: DictionaryTable[];
}

export interface InsurerBoardRow {
  name: string;
  /** null when this insurer has no configured FHIR source (fhirSlugs empty). */
  membership: { npis: number; networks: number; synced: string | null } | null;
  /** null when no rate label matched this insurer's ratePatterns. */
  rates: { npis: number; rows: number; latest: string | null } | null;
  /** Greatest of membership.synced / rates.latest, date-only. */
  lastActivity: string | null;
  note: string;
  isOther?: boolean;
}

export interface AdminPageData {
  groups: DictionaryGroup[];
  insurers: InsurerBoardRow[];
}

/** Live facts that aren't row counts — one aggregate query, see SPECIALS_SQL. */
export interface InventorySpecials {
  directoryNpis: number;
  rateNpis: number;
  rateTins: number;
  ratePayers: number;
  rateTableRows: number;
  rateTableNamed: number;
  payersLive: number;
  payersConfigured: number;
  networkPayers: number;
  photonClients: number;
  clientsTotal: number;
}

// Tables big enough that count(*) is a seq scan we refuse to pay for on a page
// load: the planner estimate (pg_class.reltuples) instead. The line is ~100k
// rows — directory_providers (123.6k) crossed it 2026-07-13.
//
// reltuples is -1 on a table that has never been ANALYZEd (and stale after a
// big load until autovacuum catches up), so the flight below falls back to an
// exact count when the estimate comes back negative — a never-analyzed table
// would otherwise render "≈-1".
const ESTIMATED = new Set([
  "directory_providers",
  "provider_rate_signals",
  "provider_network_participation",
  "nppes_npi",
  "provider_qualifications",
  "fhir_locations",
  "fhir_healthcare_services",
  "fhir_organizations",
  "rate_table_child_mv",
  "org_tin_rosters",
  "org_tin_rate_summary",
  "organizations",
  // Promoted into the dictionary this tranche; all north of the ~100k line
  // where an exact count(*) on a page load stops being free.
  "nppes_other_names",
  "org_affiliations",
  "form5500_filings",
  "form5500_schedule_a",
]);

// Every table the registry names — derived from the shared table-atlas so the
// dictionary and the Database Atlas can never name different sets (that was the
// drift NYS-100-class unification closed). Existence is probed (to_regclass)
// rather than assumed: a table whose loader hasn't run renders "not yet loaded"
// instead of failing the whole page.
const LIVE_TABLES: string[] = TABLE_GROUPS.flatMap((g) => g.tables.map((t) => t.name));

const num = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "—");

/** The five codes we actually price, straight off RATE_CODES — never a second list. */
const RATE_CODE_LIST = RATE_CODES.map((c) => c.code).join(" · ");

/** The shape of one row in the shared table-atlas registry. lib/table-atlas.mjs
 *  is JS (db-atlas.mjs runs under plain node); this mirrors its per-table record
 *  so we consume it type-safely here. */
interface AtlasTableMeta {
  name: string;
  meaning: string;
  links: string;
  sql: string;
  powers: { href: string; label: string } | null;
  keys: string[];
  joins: string[];
  blurb?: string;
}

/** Runtime facts (distinct-NPI counts, % named…) that aren't row counts — they
 *  need the live SPECIALS query, so they're keyed by table here rather than in
 *  the shared, query-free table-atlas metadata. */
function factsFor(name: string, s: InventorySpecials | null): DictionaryFact[] | undefined {
  if (!s) return undefined;
  switch (name) {
    case "directory_providers":
      return [{ label: "distinct NPIs", value: num(s.directoryNpis) }];
    case "payer_sources":
      return [{ label: "live", value: `${s.payersLive} of ${s.payersConfigured}` }];
    case "payer_networks":
      return [{ label: "across payers", value: num(s.networkPayers) }];
    case "provider_rate_signals":
      return [
        { label: "NPIs", value: num(s.rateNpis) },
        { label: "TINs", value: num(s.rateTins) },
        { label: "payer labels", value: num(s.ratePayers) },
        { label: "codes priced", value: RATE_CODE_LIST },
      ];
    case "rate_table_mv":
      return [{ label: "named", value: `${pct(s.rateTableNamed, s.rateTableRows)} of rows` }];
    default:
      return undefined;
  }
}

/** Planned/gap rows — NOT real relations, so they're absent from the shared
 *  registry (db-atlas introspects the live catalog and would never see them).
 *  Appended to their domain group by title. */
// (Empty since 2026-07-19: the canonical insurer/network layer shipped as
// sql/042–044 and lives in the atlas as real tables — the last planned row
// here fed the AI briefing a stale "NOT BUILT YET" for two days.)
const PLANNED_ROWS: Record<string, DictionaryTable[]> = {};

function buildDictionaryGroups(
  counts: Record<string, number | undefined>,
  present: Set<string>,
  s: InventorySpecials | null,
): DictionaryGroup[] {
  const build = (t: AtlasTableMeta): DictionaryTable => {
    const missing = hasDb && !present.has(t.name);
    return {
      name: t.name,
      count: !hasDb || missing ? null : counts[t.name] ?? 0,
      countKind: ESTIMATED.has(t.name) ? "estimate" : "exact",
      meaning: t.meaning,
      links: t.links,
      blurb: t.blurb,
      powers: t.powers ?? undefined,
      facts: missing ? undefined : factsFor(t.name, s),
      missing: missing || undefined,
    };
  };

  return (TABLE_GROUPS as AtlasGroupMeta[]).map((g) => ({
    title: g.title,
    blurb: g.blurb,
    platform: g.platform,
    tables: [...g.tables.map(build), ...(PLANNED_ROWS[g.title] ?? [])],
  }));
}

interface AtlasGroupMeta {
  title: string;
  blurb: string;
  platform: boolean;
  tables: AtlasTableMeta[];
}

// ── Insurers board (V2, 2026-07-13 evening) ──────────────────────────────────
// One row per insurer, membership (FHIR directory participation) + rates
// (TiC MRF) evidence, joined in JS against INSURERS below.

interface InsurerConfig {
  name: string;
  fhirSlugs: string[];
  ratePatterns: string[];
  note: string;
}

// Copy verbatim (docs/TASK-ERD-PAGE.md V2) — counts come from the DB.
const INSURERS: InsurerConfig[] = [
  { name: "UnitedHealthcare / Oxford", fhirSlugs: ["uhc"], ratePatterns: ["UnitedHealthcare", "Oxford"], note: "Largest commercial statewide · verify UHC empty-shell (NYS-17)" },
  { name: "Excellus BCBS", fhirSlugs: [], ratePatterns: ["Excellus"], note: "Dominant upstate · ToC behind Incapsula wall (NYS-29) — top coverage gap" },
  { name: "Empire BCBS / Anthem", fhirSlugs: ["anthem"], ratePatterns: ["Empire", "Anthem"], note: "API approved 2026-07-13 · membership harvest live · MRF two-pass next (NYS-25)" },
  { name: "Fidelis Care (Centene)", fhirSlugs: [], ratePatterns: ["Fidelis", "Centene"], note: "Medicaid king — Medicaid is TiC-exempt; corroborate via NYS Medicaid feed (NYS-19)" },
  { name: "Healthfirst", fhirSlugs: ["healthfirst"], ratePatterns: [], note: "Presence-only directory (coarse) · their Medicaid/EP book has no TiC files" },
  { name: "EmblemHealth (HIP/GHI)", fhirSlugs: [], ratePatterns: ["EmblemHealth", "Emblem"], note: "Rates via Carelon behavioral files · directory unprobed (sandbox-y portal)" },
  { name: "Aetna (CVS)", fhirSlugs: [], ratePatterns: ["Aetna"], note: "10 product books loaded 2026-07-13 · FHIR $export approval due any day (NYS-14)" },
  { name: "Cigna", fhirSlugs: ["cigna"], ratePatterns: ["Cigna"], note: "Full coverage both sides" },
  { name: "MVP Health Care", fhirSlugs: ["mvp"], ratePatterns: ["MVP"], note: "Largest membership book · rates behind Incapsula (NYS-29) · Carelon control case" },
  { name: "Independent Health / Highmark", fhirSlugs: [], ratePatterns: ["Highmark", "Independent Health"], note: "WNY gap · IH behind Incapsula (NYS-29)" },
  { name: "CDPHP", fhirSlugs: [], ratePatterns: ["CDPHP"], note: "Rates dense · directory publishes NO NPIs (parked, re-probe quarterly)" },
  { name: "MetroPlus", fhirSlugs: [], ratePatterns: ["MetroPlus"], note: "Rates via Carelon files" },
  { name: "Univera / Molina / Elderplan", fhirSlugs: [], ratePatterns: ["Univera", "Molina"], note: "Incapsula / no NPI path / untouched — the parked tier" },
];

type MembershipRow = { slug: string; npis: number; rows: number; networks: number; synced: string | Date | null };
type RateRow = { payer: string; npis: number; rows: number; latest: string | Date | null };

/** Greatest of two nullable date-ish values, formatted date-only. */
function maxDate(a: string | Date | null | undefined, b: string | Date | null | undefined): string | null {
  const da = a ? new Date(a).getTime() : null;
  const db = b ? new Date(b).getTime() : null;
  if (da === null && db === null) return null;
  const winner = da === null ? b! : db === null || da >= db ? a! : b!;
  return isoDateOnly(winner);
}

function buildInsurerBoard(membershipRows: MembershipRow[], rateRows: RateRow[]): InsurerBoardRow[] {
  const membershipBySlug = new Map(membershipRows.map((r) => [r.slug, r]));
  const usedSlugs = new Set<string>();
  const usedPayers = new Set<string>();

  const rows: InsurerBoardRow[] = INSURERS.map((cfg) => {
    // Every configured insurer maps to 0 or 1 live FHIR source in this table.
    const slug = cfg.fhirSlugs[0];
    const m = slug ? membershipBySlug.get(slug) : undefined;
    if (slug) usedSlugs.add(slug);
    const membership = m ? { npis: m.npis, networks: m.networks, synced: m.synced ? isoDateTime(m.synced) : null } : null;

    const matched = rateRows.filter((r) => cfg.ratePatterns.some((p) => r.payer.toLowerCase().startsWith(p.toLowerCase())));
    matched.forEach((r) => usedPayers.add(r.payer));
    const latestMatch = matched.reduce<string | Date | null>((max, r) => (!max || (r.latest && r.latest > max) ? r.latest : max), null);
    const rates = matched.length
      ? { npis: matched.reduce((s, r) => s + r.npis, 0), rows: matched.reduce((s, r) => s + r.rows, 0), latest: latestMatch ? isoDateOnly(latestMatch) : null }
      : null;

    return { name: cfg.name, membership, rates, lastActivity: maxDate(m?.synced, latestMatch), note: cfg.note };
  });

  // Rate labels / FHIR sources no configured insurer claimed — the BCBS
  // host-sharing catch (other-state Blues) plus any source not yet mapped
  // above (e.g. Humana, which this table deliberately doesn't list yet).
  const otherMembership = membershipRows.filter((r) => !usedSlugs.has(r.slug));
  const otherRates = rateRows.filter((r) => !usedPayers.has(r.payer));
  if (otherMembership.length || otherRates.length) {
    const otherSynced = otherMembership.reduce<string | Date | null>((max, r) => (!max || (r.synced && r.synced > max) ? r.synced : max), null);
    const otherLatest = otherRates.reduce<string | Date | null>((max, r) => (!max || (r.latest && r.latest > max) ? r.latest : max), null);
    rows.push({
      name: "Other / spillover",
      membership: otherMembership.length
        ? {
            npis: otherMembership.reduce((s, r) => s + r.npis, 0),
            networks: otherMembership.reduce((s, r) => s + r.networks, 0),
            synced: otherSynced ? isoDateTime(otherSynced) : null,
          }
        : null,
      rates: otherRates.length
        ? { npis: otherRates.reduce((s, r) => s + r.npis, 0), rows: otherRates.reduce((s, r) => s + r.rows, 0), latest: otherLatest ? isoDateOnly(otherLatest) : null }
        : null,
      lastActivity: maxDate(otherSynced, otherLatest),
      note: "Unmatched FHIR sources + rate labels — other-state BCBS host-sharing and any payer not yet mapped above.",
      isOther: true,
    });
  }

  return rows;
}

// ── the inventory: three round trips, one shared memo ─────────────────────────

export interface PlatformInventory {
  groups: DictionaryGroup[];
  specials: InventorySpecials | null;
  /** When these numbers were read, ISO. */
  generatedAt: string;
}

/** Registry names are ours, never user input — but they reach SQL as identifiers
 *  (count(*) can't parameterize a table name), so they get checked anyway. */
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;

// Live facts that aren't row counts. One query, all scalar subqueries, ~200ms:
// every expensive-looking count here is answered by a matview or a small table,
// never by a scan of the 9.3M-row signals corpus.
//   · rate NPIs  = count of provider_rate_summary (one row per NPI, sql/021)
//   · rate TINs  = distinct tin over org_tin_rosters (150k, sql/025)
//   · payers     = payer_rate_totals (29 rows, sql/026)
const SPECIALS_SQL = `
  SELECT (SELECT count(DISTINCT npi) FROM directory_providers)                    AS directory_npis,
         (SELECT count(*) FROM provider_rate_summary)                             AS rate_npis,
         (SELECT count(DISTINCT tin) FROM org_tin_rosters)                        AS rate_tins,
         (SELECT count(*) FROM payer_rate_totals)                                 AS rate_payers,
         (SELECT count(*) FROM rate_table_mv)                                     AS rate_table_rows,
         (SELECT count(*) FROM rate_table_mv WHERE display_name IS NOT NULL)      AS rate_table_named,
         (SELECT count(*) FROM payer_sources WHERE last_synced_at IS NOT NULL)    AS payers_live,
         -- Retired sources (out-of-region, superseded — NYS-72) are history,
         -- not aspiration: they don't belong in the "of N" denominator.
         (SELECT count(*) FROM payer_sources WHERE status IS DISTINCT FROM 'retired') AS payers_configured,
         (SELECT count(DISTINCT payer_source_id) FROM payer_networks)             AS network_payers,
         (SELECT count(*) FROM clients WHERE photon_patient_id IS NOT NULL)       AS photon_clients,
         (SELECT count(*) FROM clients)                                           AS clients_total
`;

let inventoryMemo: { at: number; data: PlatformInventory } | null = null;

/**
 * The whole table inventory — counts, facts, prose — memoized in-process.
 *
 * `maxAgeMs` is the caller's freshness appetite, and both consumers share ONE
 * memo entry: /admin/data asks for 60s (its counts are watched during a live
 * harvest), /dashboard accepts 5 minutes (nobody reloads a dashboard to watch
 * nppes_npi tick). Whoever refetches first, the other reuses it — so the
 * dashboard is usually free, and asking for fresher never serves staler.
 *
 * Three round trips, not one-per-table (the old shape fired 26 parallel HTTP
 * requests at Neon for 26 counts):
 *   1. pg_class probe — existence + planner estimate for every registry name.
 *   2. one batched query of exact count(*)s, for the small tables only.
 *   3. SPECIALS_SQL — the facts that aren't row counts.
 * A missing table (loader hasn't run) drops out at step 1 and renders "not yet
 * loaded"; it never reaches step 2, so it can't take the page down with it.
 */
export async function platformInventory(maxAgeMs = 5 * 60_000): Promise<PlatformInventory> {
  if (inventoryMemo && Date.now() - inventoryMemo.at < maxAgeMs) return inventoryMemo.data;

  if (!hasDb) {
    return { groups: buildDictionaryGroups({}, new Set(), null), specials: null, generatedAt: new Date().toISOString() };
  }

  const names = LIVE_TABLES.filter((t) => SAFE_IDENT.test(t));

  const probe = (await sql.query(
    `SELECT t.name, (c.oid IS NOT NULL) AS present, COALESCE(c.reltuples, -1)::bigint AS est
     FROM unnest($1::text[]) AS t(name)
     LEFT JOIN pg_class c ON c.oid = to_regclass(t.name)`,
    [names as unknown as string[]],
  )) as Array<{ name: string; present: boolean; est: number }>;

  const present = new Set(probe.filter((r) => r.present).map((r) => r.name));
  const counts: Record<string, number> = {};

  // An ESTIMATED table whose planner estimate is missing (-1 = never ANALYZEd)
  // falls back to an exact count rather than rendering "≈-1". Costly on a huge
  // never-analyzed table, but that state doesn't survive the first autovacuum.
  const exact: string[] = [];
  for (const r of probe) {
    if (!r.present) continue;
    if (ESTIMATED.has(r.name) && Number(r.est) >= 0) counts[r.name] = Number(r.est);
    else exact.push(r.name);
  }

  const exactSql = exact.length
    ? `SELECT ${exact.map((t) => `(SELECT count(*) FROM ${t}) AS "${t}"`).join(", ")}`
    : null;

  const [exactRows, specialRows] = await Promise.all([
    exactSql ? (sql.query(exactSql, []) as Promise<Array<Record<string, number>>>) : Promise.resolve([]),
    sql.query(SPECIALS_SQL, []) as Promise<Array<Record<string, number>>>,
  ]);

  for (const [k, v] of Object.entries(exactRows[0] ?? {})) counts[k] = Number(v);

  const r = specialRows[0];
  const specials: InventorySpecials | null = r
    ? {
        directoryNpis: Number(r.directory_npis),
        rateNpis: Number(r.rate_npis),
        rateTins: Number(r.rate_tins),
        ratePayers: Number(r.rate_payers),
        rateTableRows: Number(r.rate_table_rows),
        rateTableNamed: Number(r.rate_table_named),
        payersLive: Number(r.payers_live),
        payersConfigured: Number(r.payers_configured),
        networkPayers: Number(r.network_payers),
        photonClients: Number(r.photon_clients),
        clientsTotal: Number(r.clients_total),
      }
    : null;

  const data: PlatformInventory = {
    groups: buildDictionaryGroups(counts, present, specials),
    specials,
    generatedAt: new Date().toISOString(),
  };
  inventoryMemo = { at: Date.now(), data };
  return data;
}

// ── page data: one flight, one memo ───────────────────────────────────────────

let adminPageMemo: { at: number; data: AdminPageData } | null = null;

/**
 * Everything /admin/data renders (both tabs), one query flight, memoized 60s.
 * The membership query stays live on purpose — the Anthem FHIR harvest
 * writes provider_network_participation while this page is open, and the
 * Insurers tab's whole point is showing that NPI count climb between loads
 * (never matview it). Its `count(DISTINCT npi)` forces a sort that spills to
 * disk on ~1.3M rows; `SET LOCAL work_mem` for just this query (via
 * sql.transaction, one HTTP round trip) cuts that from ~2s to ~1.5-1.7s.
 * The dictionary half comes from platformInventory() at the same 60s freshness.
 */
export async function adminPageData(): Promise<AdminPageData> {
  if (adminPageMemo && Date.now() - adminPageMemo.at < 60_000) return adminPageMemo.data;

  if (!hasDb) {
    const { groups } = await platformInventory(60_000);
    return {
      groups,
      insurers: INSURERS.map((cfg) => ({ name: cfg.name, membership: null, rates: null, lastActivity: null, note: cfg.note })),
    };
  }

  const [{ groups }, [, membershipRows], rateRows] = await Promise.all([
    platformInventory(60_000),
    sql.transaction([
      sql`SET LOCAL work_mem = '128MB'`,
      sql`
        SELECT s.slug, count(DISTINCT p.npi)::int AS npis, count(*)::int AS rows,
               count(DISTINCT p.network_id)::int AS networks, max(s.last_synced_at) AS synced
        FROM payer_sources s LEFT JOIN provider_network_participation p ON p.payer_source_id = s.id
        GROUP BY s.slug
      `,
    ]) as unknown as Promise<[unknown, MembershipRow[]]>,
    sql`SELECT payer, npis, rows, latest FROM payer_rate_totals` as unknown as Promise<RateRow[]>,
  ]);

  const data: AdminPageData = { groups, insurers: buildInsurerBoard(membershipRows, rateRows) };
  adminPageMemo = { at: Date.now(), data };
  return data;
}

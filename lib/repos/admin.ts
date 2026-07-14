import { hasDb, sql } from "@/lib/db";
import { isoDateOnly, isoDateTime } from "@/lib/format";

// admin.ts — the live data dictionary + Insurers board (docs/TASK-ERD-PAGE.md,
// V2). Founder-only /admin/data page. Both tabs' data comes from ONE
// adminPageData() call: every underlying query fires in a single Promise.all
// flight (no sequential awaits anywhere in the path) and the whole payload is
// memoized 60s in-process — same house pattern as searchProviders' default-
// listing memo (lib/repos/directory.ts). A cold load pays for the queries
// once; every load in the next 60s is free.

export interface DictionaryTable {
  /** Table or matview name, rendered mono. */
  name: string;
  /** Live row count; null in mock mode ("—"). */
  count: number | null;
  /** "estimate" tables use the pg_class planner estimate (≈), never exact count(*). */
  countKind: "exact" | "estimate";
  meaning: string;
  links: string;
  /** Present only on planned/gap rows — the Linear ref shown in place of a count. */
  planned?: string;
}

export interface DictionaryGroup {
  title: string;
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

// Tables that can exceed ~100k rows get the planner estimate, not count(*) —
// directory_providers (123.6k) crossed that line 2026-07-13; the two others
// were already there.
const ESTIMATED = new Set(["directory_providers", "provider_rate_signals", "provider_network_participation"]);

const LIVE_TABLES = [
  "directory_providers",
  "directory_programs",
  "payer_sources",
  "payer_networks",
  "provider_network_participation",
  "payer_unmatched_npis",
  "provider_rate_signals",
  "provider_rate_summary",
  "provider_participation_summary",
  "tin_registry",
  "employers",
  "plans",
  "users",
  "clients",
  "appointments",
  "invoices",
  "notes",
  "messages",
  "files",
  "payers",
  "insurance_policies",
] as const;

function buildDictionaryGroups(counts: Record<string, number>): DictionaryGroup[] {
  const table = (name: string, meaning: string, links: string, opts?: { estimated?: boolean }): DictionaryTable => ({
    name,
    count: hasDb ? counts[name] ?? 0 : null,
    countKind: opts?.estimated ?? ESTIMATED.has(name) ? "estimate" : "exact",
    meaning,
    links,
  });

  const planned = (name: string, meaning: string, ref: string): DictionaryTable => ({
    name,
    count: null,
    countKind: "exact",
    meaning,
    links: "—",
    planned: ref,
  });

  return [
    {
      title: "Who exists (foundation)",
      tables: [
        table(
          "directory_providers",
          "NY behavioral-health provider book; one row per (source, source_id); ~123.6k rows / 106.5k distinct NPIs; person-level merge open (NYS-34).",
          "everything keys on npi",
        ),
        table("directory_programs", "OMH programs (6.5k); powers /programs + portal resources.", "county / program_type (no npi join)"),
        planned("organizations", "NPI-2 orgs; all NY + national platforms.", "NYS-41"),
        planned("cpt_codes", "Reference labels for billing codes.", "NYS-50"),
      ],
    },
    {
      title: "Insurance graph",
      tables: [
        table("payer_sources", "Insurers we harvest FHIR directories from (12; 6 live).", "id → payer_networks.payer_source_id"),
        table(
          "payer_networks",
          "Per-insurer network labels from directories (anthem 356+ · cigna 226 · uhc 213 · humana 135 · mvp 18).",
          "id → provider_network_participation.network_id",
        ),
        table(
          "provider_network_participation",
          "Payer-attested membership: one row per (npi × payer × network × location); carries accepting-new-patients + as-of. THE membership evidence, FHIR flavor.",
          "npi → directory_providers",
        ),
        table(
          "payer_unmatched_npis",
          "Providers payers mention that we don't hold; discovery pool (NYS-40; big pool still in .harvest files).",
          "npi (no directory_providers match yet)",
        ),
        planned(
          "insurers / networks (canonical)",
          "Canonical insurers + canonical networks + label crosswalk — until then, FHIR and MRF vocabularies do not join.",
          "NYS-48, NYS-49",
        ),
      ],
    },
    {
      title: "Rates (Transparency-in-Coverage)",
      tables: [
        table(
          "provider_rate_signals",
          `Negotiated rates: one row per (npi × tin × payer × plan/network label × CPT × rate × POS × file date). ≈5.4M rows / ~47k NPIs across 28 payer labels. A rate proves a CONTRACT as of a date — never patient cost, never "standalone" membership language.`,
          "npi, tin, source_file",
        ),
        table(
          "provider_rate_summary",
          "Per-NPI rate rollup (matview) feeding /recruiting + /plans; refresh after every load.",
          "npi (rollup of provider_rate_signals)",
        ),
        table(
          "provider_participation_summary",
          "Per-NPI network aggregate (matview, sql/023) feeding the directory Accepting/Network sort; refresh with the other matview after every ingest.",
          "npi (rollup of provider_network_participation)",
        ),
        table("tin_registry", "TIN → business-name registry; nearly empty (4 rows), backfill open (NYS-27).", "tin_norm ↔ provider_rate_signals.tin"),
      ],
    },
    {
      title: "Employers & plans",
      tables: [
        table("employers", "Plan sponsors from the Aetna ToC (2,315; EIN-keyed).", "ein → plans.employer_ein"),
        table("plans", "Employer plans (15,221); each points at a network product; display cleanup NYS-44.", "source_file → provider_rate_signals.source_file"),
      ],
    },
    {
      title: "Practice management (EHR)",
      tables: [
        table("users", "Login accounts: staff (admin/practitioner) and client portal users; soft-deleted via deleted_at.", "id → practitioner/author refs across appointments, notes, messages, files"),
        table("clients", "Patient/client records; user_id links an optional portal login. PHI.", "id → appointments, invoices, notes, messages, files, insurance_policies"),
        table("appointments", "Calendar events tying client + practitioner + service + location with a status lifecycle.", "client_id, practitioner_id"),
        table("invoices", "Client invoices with human numbers (INV-2026-0001) and a draft→sent→paid/overdue/void lifecycle.", "client_id"),
        table("notes", "Clinical documentation (soft-deleted, sign-and-lock lifecycle); PHI.", "client_id"),
        table("messages", "Individual secure messages within a thread; read_at marks recipient receipt. PHI.", "thread_id → threads.client_id"),
        table("files", "Client documents: portal uploads, rendered form PDFs, generated superbills. PHI.", "client_id"),
        table("payers", "Insurance companies (name + clearinghouse payer code) — billing, distinct from payer_sources.", "id → insurance_policies.payer_id"),
        table("insurance_policies", "A client's coverage with a payer (member/group ids, verification status, copay). PHI.", "client_id, payer_id"),
      ],
    },
  ];
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
 * Everything else — the 21 dictionary counts (estimated on tables over
 * ~100k rows) and the sql/026-matview-backed rate totals — is sub-100ms.
 */
export async function adminPageData(): Promise<AdminPageData> {
  if (adminPageMemo && Date.now() - adminPageMemo.at < 60_000) return adminPageMemo.data;

  if (!hasDb) {
    const data: AdminPageData = {
      groups: buildDictionaryGroups({}),
      insurers: INSURERS.map((cfg) => ({ name: cfg.name, membership: null, rates: null, lastActivity: null, note: cfg.note })),
    };
    return data;
  }

  const [countPairs, [, membershipRows], rateRows] = await Promise.all([
    Promise.all(
      LIVE_TABLES.map(async (t) => {
        const rows = (ESTIMATED.has(t)
          ? await sql.query(`SELECT reltuples::bigint AS n FROM pg_class WHERE relname = $1`, [t])
          : await sql.query(`SELECT count(*)::bigint AS n FROM ${t}`, [])) as Array<{ n: number }>;
        return [t, Number(rows[0]?.n ?? 0)] as const;
      }),
    ),
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

  const counts = Object.fromEntries(countPairs);
  const data: AdminPageData = {
    groups: buildDictionaryGroups(counts),
    insurers: buildInsurerBoard(membershipRows, rateRows),
  };
  adminPageMemo = { at: Date.now(), data };
  return data;
}

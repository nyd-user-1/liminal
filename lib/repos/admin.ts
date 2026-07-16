import { hasDb, sql } from "@/lib/db";
import { isoDateOnly, isoDateTime } from "@/lib/format";
import { RATE_CODES } from "@/lib/rate-table";

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
]);

// Every table the registry names. Existence is probed (to_regclass) rather than
// assumed: the CMS loader landed mid-build, so a table whose loader hasn't run
// renders "not yet loaded" instead of failing the whole page.
const LIVE_TABLES = [
  "directory_providers",
  "directory_programs",
  "provider_qualifications",
  "nppes_npi",
  "organizations",
  "cpt_codes",
  "hcpcs_codes",
  "cms_rvu",
  "cms_gpci",
  "cms_pfs_config",
  "medicare_benchmark_ny",
  "payer_sources",
  "payer_networks",
  "provider_network_participation",
  "payer_unmatched_npis",
  "fhir_locations",
  "fhir_organizations",
  "fhir_org_affiliations",
  "fhir_healthcare_services",
  "fhir_insurance_plans",
  "provider_rate_signals",
  "provider_rate_summary",
  "provider_participation_summary",
  "rate_table_mv",
  "rate_table_child_mv",
  "org_tin_rosters",
  "org_tin_rate_summary",
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

const num = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "—");

/** The five codes we actually price, straight off RATE_CODES — never a second list. */
const RATE_CODE_LIST = RATE_CODES.map((c) => c.code).join(" · ");

type TableExtra = {
  /** Observatory card gloss — plain language, no jargon. Falls back to `meaning`. */
  blurb?: string;
  powers?: { href: string; label: string };
  facts?: DictionaryFact[];
  estimated?: boolean;
};

function buildDictionaryGroups(
  counts: Record<string, number | undefined>,
  present: Set<string>,
  s: InventorySpecials | null,
): DictionaryGroup[] {
  const table = (name: string, meaning: string, links: string, opts?: TableExtra): DictionaryTable => {
    const missing = hasDb && !present.has(name);
    return {
      name,
      count: !hasDb || missing ? null : counts[name] ?? 0,
      countKind: opts?.estimated ?? ESTIMATED.has(name) ? "estimate" : "exact",
      meaning,
      links,
      blurb: opts?.blurb,
      powers: opts?.powers,
      facts: missing ? undefined : opts?.facts,
      missing: missing || undefined,
    };
  };

  const planned = (name: string, meaning: string, ref: string): DictionaryTable => ({
    name,
    count: null,
    countKind: "exact",
    meaning,
    links: "—",
    planned: ref,
  });

  const DIRECTORY = { href: "/directory", label: "Directory" };

  return [
    {
      title: "Who exists (foundation)",
      blurb: "The provider book everything else keys on. One clinician, one NPI, many sources.",
      platform: true,
      tables: [
        table(
          "directory_providers",
          "NY behavioral-health provider book; one row per (source, source_id). Rows exceed distinct NPIs because one clinician arrives from several sources; person-level merge open (NYS-34).",
          "everything keys on npi",
          {
            blurb: "Every NY behavioral-health provider we hold, merged from NPPES, Medicaid and OMH.",
            powers: DIRECTORY,
            facts: s ? [{ label: "distinct NPIs", value: num(s.directoryNpis) }] : undefined,
          },
        ),
        table("directory_programs", "OMH programs; powers /programs + portal resources.", "county / program_type (no npi join)", {
          blurb: "State-licensed treatment programs — the clinics, not the clinicians.",
          powers: { href: "/programs", label: "Programs" },
        }),
        table("provider_qualifications", "Per-NPI licenses and taxonomies; the source of the profession + credential filters.", "npi → directory_providers", {
          blurb: "What each provider is licensed as. Licensing, which is not the same as what they treat.",
          powers: DIRECTORY,
        }),
        table(
          "nppes_npi",
          "The raw national NPPES registry as loaded — every provider in the country, all specialties. directory_providers is the NY behavioral-health distillation of it.",
          "npi → directory_providers",
          { blurb: "The raw national NPI registry we distil the NY book out of.", powers: DIRECTORY },
        ),
        table(
          "organizations",
          "NPI-2 org book (sql/034): every NY organization + every org our datasets reference nationwide (105.6k; 103.8k NY + 1.8k net-new national platforms like Headway). Derived in SQL from nppes_npi; no EIN (NPPES has none). 3.1k are also billing TINs — the first NPI-2 ↔ billing-TIN join.",
          "npi ↔ tin_registry / org_tin_rosters",
          { blurb: "The organizations behind the NPIs — clinics, groups and national platforms, not the people.", powers: DIRECTORY },
        ),
        table(
          "cpt_codes",
          "OUR OWN plain-language names for billing codes (14 behavioral-health codes) — never AMA descriptor text, which is licensed. Editable content; the five live codes match RATE_CODES in lib/rate-table.ts. See scripts/cms/LICENSE_NOTE.md.",
          "code → provider_rate_signals.billing_code · service_code_names",
          { blurb: "Our own plain-language names for the codes we price. AMA descriptor text is licensed; this is not it." },
        ),
        table(
          "hcpcs_codes",
          "CMS HCPCS Level II (8.7k codes, HCPCS-2026-Q3) with OFFICIAL descriptors — public and displayable, unlike CPT. Where NY Medicaid behavioral health lives (H0004/H0015/H2019). Vocabulary only: we hold ZERO rates for these — the MRF scanner's code list is CPT-only.",
          "code · service_code_names",
          { blurb: "The public code set, descriptors and all — where NY Medicaid behavioral health lives. Vocabulary only, no rates." },
        ),
      ],
    },
    {
      title: "Insurance graph",
      blurb: "Who is in which network, attested by the payer's own directory.",
      platform: true,
      tables: [
        table("payer_sources", "Insurers we harvest FHIR directories from.", "id → payer_networks.payer_source_id", {
          blurb: "The insurers whose directories we pull. Configured is not the same as live.",
          facts: s ? [{ label: "live", value: `${s.payersLive} of ${s.payersConfigured}` }] : undefined,
        }),
        table(
          "payer_networks",
          "Per-insurer network labels from directories (anthem 356+ · cigna 226 · uhc 213 · humana 135 · mvp 18).",
          "id → provider_network_participation.network_id",
          {
            blurb: "Every named network/product a payer publishes — the labels membership hangs off.",
            facts: s ? [{ label: "across payers", value: num(s.networkPayers) }] : undefined,
          },
        ),
        table(
          "provider_network_participation",
          "Payer-attested membership: one row per (npi × payer × network × location); carries accepting-new-patients + as-of. THE membership evidence, FHIR flavor.",
          "npi → directory_providers",
          {
            blurb: "The payer's own claim that a provider is in a network. This is what the insurance badge reads.",
            powers: { href: "/directory", label: "Directory" },
          },
        ),
        table(
          "payer_unmatched_npis",
          "Providers payers mention that we don't hold; discovery pool (NYS-40; big pool still in .harvest files).",
          "npi (no directory_providers match yet)",
          { blurb: "Providers a payer names that our book has never heard of. The discovery pool." },
        ),
        table("fhir_locations", "Practice sites from payer FHIR directories. National, not NY-only.", "location → healthcare_services, participation", {
          blurb: "Physical sites a payer publishes — the addresses behind a network listing.",
        }),
        table("fhir_organizations", "Org entities from payer FHIR directories (groups, facilities).", "organization → org_affiliations", {
          blurb: "The organizations a payer names, as the payer models them.",
        }),
        table("fhir_org_affiliations", "Org ↔ network/org relationships as published.", "organization ↔ network", {
          blurb: "How a payer wires its orgs to its networks.",
        }),
        table("fhir_healthcare_services", "Services offered at a location (the payer's own service taxonomy).", "location → service", {
          blurb: "What a payer says is offered where — their taxonomy, not ours.",
        }),
        table("fhir_insurance_plans", "InsurancePlan resources — the plan/product objects behind the network labels.", "plan → network", {
          blurb: "The plan objects payers publish alongside their networks.",
        }),
        planned(
          "insurers / networks (canonical)",
          "Canonical insurers + canonical networks + label crosswalk — until then, FHIR and MRF vocabularies do not join.",
          "NYS-48, NYS-49",
        ),
      ],
    },
    {
      title: "Rates (Transparency-in-Coverage)",
      blurb: "What payers actually pay, from their own published machine-readable files.",
      platform: true,
      tables: [
        table(
          "provider_rate_signals",
          `Negotiated rates: one row per (npi × tin × payer × plan/network label × CPT × rate × POS × file date). A rate proves a CONTRACT as of a date — never patient cost, never "standalone" membership language.`,
          "npi, tin, source_file",
          {
            blurb: "The rate corpus. One row = one payer's published price for one code, at one TIN, on one date.",
            powers: { href: "/rates", label: "Rates" },
            facts: s
              ? [
                  { label: "NPIs", value: num(s.rateNpis) },
                  { label: "TINs", value: num(s.rateTins) },
                  { label: "payer labels", value: num(s.ratePayers) },
                  { label: "codes priced", value: RATE_CODE_LIST },
                ]
              : undefined,
          },
        ),
        table(
          "provider_rate_summary",
          "Per-NPI rate rollup (matview) feeding /recruiting + /plans; refresh after every load.",
          "npi (rollup of provider_rate_signals)",
          { blurb: "One row per provider: what they're paid, precomputed so /recruiting stays fast.", powers: { href: "/recruiting", label: "Recruiting" } },
        ),
        table(
          "provider_participation_summary",
          "Per-NPI network aggregate (matview, sql/023) feeding the directory Accepting/Network sort; refresh with the other matview after every ingest.",
          "npi (rollup of provider_network_participation)",
          { blurb: "One row per provider: which networks they're in, precomputed for the directory sort.", powers: { href: "/directory", label: "Directory" } },
        ),
        table("rate_table_mv", "The published rate table (matview, sql/024): one row per (payer, TIN) with per-code rates + clinician counts.", "tin, payer → rate_table_child_mv", {
          blurb: "The rate table the public page renders — precomputed, which is why it loads instantly.",
          powers: { href: "/published-rates", label: "Published rates" },
          facts: s ? [{ label: "named", value: `${pct(s.rateTableNamed, s.rateTableRows)} of rows` }] : undefined,
        }),
        table("rate_table_child_mv", "Per-network/setting detail rows under each rate_table_mv parent.", "tin, payer ← rate_table_mv", {
          blurb: "The breakdown under each rate-table row: network and setting.",
          powers: { href: "/published-rates", label: "Published rates" },
        }),
        table("org_tin_rosters", "Per-TIN clinician roster (matview, sql/025): who bills under each org.", "tin, npi", {
          blurb: "Who bills under each organization — the roster behind an org page.",
          powers: { href: "/orgs", label: "Organizations" },
        }),
        table("org_tin_rate_summary", "Per-(TIN, payer, code) rate percentiles (matview, sql/025).", "tin, payer, billing_code", {
          blurb: "What each organization is paid, per payer and code, at p25/median/p75.",
          powers: { href: "/orgs", label: "Organizations" },
        }),
        table("tin_registry", "TIN → business-name registry; the naming layer behind every org display name (NYS-27 backfill has run).", "tin_norm ↔ provider_rate_signals.tin", {
          blurb: "Turns a bare tax ID into a business name. Without it every org reads as a 9-digit number.",
          powers: { href: "/orgs", label: "Organizations" },
        }),
      ],
    },
    {
      // Not Transparency-in-Coverage: this is CMS's own fee schedule, and it is
      // the DENOMINATOR the TiC rates above are measured against. Free, no
      // license, no key — the whole "% of Medicare" product rests on it.
      title: "Medicare benchmark (CMS PFS, sql/033)",
      blurb: "What Medicare itself pays per NY locality — the yardstick every negotiated rate is measured against.",
      platform: true,
      tables: [
        table(
          "medicare_benchmark_ny",
          "The computed benchmark: what Medicare allows per (NY locality × code), derived from cms_rvu × cms_gpci × the conversion factor. The denominator every '% of Medicare' number on the platform divides by.",
          "state+locality_code+code (from cms_rvu · cms_gpci · cms_pfs_config)",
          {
            blurb: "What Medicare pays here, per code and NY locality. Everything else is priced against this.",
            powers: { href: "/rates", label: "Rates" },
          },
        ),
        table(
          "cms_rvu",
          "PFS Relative Value File (RVU26C, 19.4k rows): work/PE/MP RVUs per code × modifier. Deliberately carries NO descriptor column — that text is AMA-licensed to CMS, not to us.",
          "hcpcs_code → cpt_codes.code · medicare_benchmark_ny",
          { blurb: "How much work each code represents, per CMS. The raw input to the benchmark." },
        ),
        table(
          "cms_gpci",
          "CY2026 geographic practice cost indices, 109 localities. NY has five (Manhattan · NYC Suburbs/LI · Poughkeepsie · Queens · Rest of NY). Keyed (state, locality) — locality numbers repeat across states.",
          "state+locality_code → medicare_benchmark_ny",
          { blurb: "The geography multiplier — why the same code pays differently in Manhattan and Buffalo." },
        ),
        table(
          "cms_pfs_config",
          "PFS scalars. CY2026 ships TWO conversion factors — $33.4009 non-APM (what the benchmark uses) and $33.5675 for qualifying APM participants; both read out of the CMS files themselves.",
          "key → medicare_benchmark_ny",
          { blurb: "The dollars-per-RVU scalars that turn relative units into money." },
        ),
      ],
    },
    {
      title: "Employers & plans",
      blurb: "Which employer buys which plan — the demand side of the rate corpus.",
      platform: true,
      tables: [
        table("employers", "Plan sponsors from the Aetna ToC (EIN-keyed).", "ein → plans.employer_ein", {
          blurb: "The employers sponsoring the plans we hold rates for.",
          powers: { href: "/plans", label: "Plans" },
        }),
        table("plans", "Employer plans; each points at a network product; display cleanup NYS-44.", "source_file → provider_rate_signals.source_file", {
          blurb: "The plan catalog — each one ties an employer to a network product and its rate file.",
          powers: { href: "/plans", label: "Plans" },
        }),
      ],
    },
    {
      // platform:false — the observatory is the DATA platform. These are the
      // practice's own records (mostly PHI); the dashboard's Layer-1 strip
      // covers them as caseload numbers, scoped to who's asking.
      title: "Practice management (EHR)",
      blurb: "The practice's own records. PHI — counts only, never contents.",
      platform: false,
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

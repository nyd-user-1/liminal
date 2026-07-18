// table-atlas.mjs — the ONE table registry.
//
// Every documented relation in the platform, grouped by domain, with the prose
// and graph metadata that describe it. Two very different consumers read this
// same list, which is the whole point:
//
//   • lib/repos/admin.ts (platformInventory) — powers /admin/data (the founder's
//     data dictionary) and the /dashboard + /insights Observatory. It layers
//     live counts and runtime facts on top of these rows.
//   • scripts/db-atlas.mjs — the Database Atlas generator (docs/data/DATABASE.md
//     + the Obsidian graph). It layers introspected columns, row estimates and
//     detected FKs on top of these rows.
//
// Before this module they were two hand-kept copies that drifted (rate_table_mv
// read "sql/024" in one and "sql/027" in the other; meanings diverged). Now a
// table's meaning, domain, page and join graph live in exactly one place, so the
// dictionary and the atlas are provably the same knowledge.
//
// It is a .mjs (not .ts) on purpose: db-atlas.mjs runs under plain `node`, which
// can't import TypeScript, while admin.ts imports it fine (allowJs + bundler
// resolution). Keep it dependency-free, data-only.
//
// Per-table fields:
//   name    — relation name (table or matview), the join-graph key.
//   meaning — one sentence: what it is and what it is NOT. The authority.
//   links   — the human "what it joins to" sentence the dictionary prints.
//   sql     — the numbered migration that DEFINES it (verified against the tree,
//             not either old copy — this is where the drift was).
//   powers  — { href, label } of the page it feeds, or null. db-atlas reads
//             only the href.
//   keys    — the columns its declared joins ride on (drives the atlas graph).
//   joins   — relations it links to (undirected; declaring one side is enough).
//   blurb   — optional plain-language Observatory gloss; falls back to meaning.
//
// Runtime facts (distinct-NPI counts, % named, …) are NOT here — they need a
// live query and stay in admin.ts's factsFor(). The count/estimate decision also
// stays with each consumer (admin's ESTIMATED set; db-atlas's row-estimate
// threshold): it is an operational concern, not a description of the table.

/**
 * @typedef {Object} AtlasTable
 * @property {string} name
 * @property {string} meaning
 * @property {string} links
 * @property {string} sql
 * @property {{ href: string, label: string } | null} powers
 * @property {string[]} keys
 * @property {string[]} joins
 * @property {string} [blurb]
 */

/**
 * @typedef {Object} AtlasGroup
 * @property {string} title
 * @property {string} blurb
 * @property {boolean} platform  false only for the EHR group (PHI, not the data platform).
 * @property {AtlasTable[]} tables
 */

const DIRECTORY = { href: "/directory", label: "Directory" };
const RATES = { href: "/rates", label: "Rates" };
const PLANS = { href: "/plans", label: "Plans" };
const ORGS = { href: "/orgs", label: "Organizations" };
const PUBLISHED = { href: "/published-rates", label: "Published rates" };
const INSIGHTS = { href: "/insights", label: "Insights" };

/** @type {AtlasGroup[]} */
export const TABLE_GROUPS = [
  {
    title: "Who exists (foundation)",
    blurb: "The provider book everything else keys on. One clinician, one NPI, many sources.",
    platform: true,
    tables: [
      {
        name: "directory_providers",
        meaning:
          "NY behavioral-health provider book; one row per (source, source_id). Rows exceed distinct NPIs because one clinician arrives from several sources; person-level merge open (NYS-34).",
        links: "everything keys on npi",
        sql: "sql/003",
        powers: DIRECTORY,
        keys: ["npi"],
        joins: ["nppes_npi", "provider_qualifications", "provider_network_participation", "provider_rate_signals", "provider_rate_summary", "provider_participation_summary", "org_tin_rosters"],
        blurb: "Every NY behavioral-health provider we hold, merged from NPPES, Medicaid and OMH.",
      },
      {
        name: "directory_programs",
        meaning: "OMH state-licensed treatment programs — the clinics, not the clinicians; powers /programs and the portal resources.",
        links: "county / program_type (no npi join)",
        sql: "sql/003",
        powers: { href: "/programs", label: "Programs" },
        keys: ["county"],
        joins: [],
        blurb: "State-licensed treatment programs — the clinics, not the clinicians.",
      },
      {
        name: "provider_qualifications",
        meaning: "Per-NPI licenses, degrees and taxonomies — the source of the profession + credential filters. Licensing, not what a provider treats.",
        links: "npi → directory_providers",
        sql: "sql/028",
        powers: DIRECTORY,
        keys: ["npi"],
        joins: ["directory_providers", "nppes_npi", "nucc_taxonomy"],
        blurb: "What each provider is licensed as. Licensing, which is not the same as what they treat.",
      },
      {
        name: "nppes_npi",
        meaning:
          "The raw national NPPES registry as loaded — every provider in the country, all specialties. directory_providers is the NY behavioral-health distillation of it.",
        links: "npi → directory_providers",
        sql: "sql/030",
        powers: DIRECTORY,
        keys: ["npi"],
        joins: ["directory_providers", "organizations", "provider_qualifications", "nppes_other_names", "nppes_organizations"],
        blurb: "The raw national NPI registry we distil the NY book out of.",
      },
      {
        name: "organizations",
        meaning:
          "NPI-2 org book (sql/034): every NY organization + every org our datasets reference nationwide (NY book + net-new national platforms like Headway). Derived in SQL from nppes_npi; no EIN (NPPES suppresses it). Some are also billing TINs — the first NPI-2 ↔ billing-TIN join.",
        links: "npi ↔ tin_registry / org_tin_rosters",
        sql: "sql/034",
        powers: DIRECTORY,
        keys: ["npi", "tin"],
        joins: ["nppes_npi", "tin_registry", "org_tin_rosters", "nppes_organizations"],
        blurb: "The organizations behind the NPIs — clinics, groups and national platforms, not the people.",
      },
      {
        name: "cpt_codes",
        meaning:
          "OUR OWN plain-language names for the behavioral billing codes (20 codes) — never AMA descriptor text, which is licensed. The single source of display labels (lib/cpt-labels.generated.ts regenerates from it); the five live codes match RATE_CODES in lib/rate-table.ts.",
        links: "code → provider_rate_signals.billing_code · service_code_names",
        sql: "sql/033",
        powers: null,
        keys: ["code"],
        joins: ["provider_rate_signals", "cms_rvu"],
        blurb: "Our own plain-language names for the codes we price. AMA descriptor text is licensed; this is not it.",
      },
      {
        name: "hcpcs_codes",
        meaning:
          "CMS HCPCS Level II with OFFICIAL descriptors (public, unlike CPT). Where NY Medicaid behavioral codes live (H0004/H0015/H2019). Vocabulary only — we hold zero rates for these; the MRF scanner's code list is CPT-only.",
        links: "code · service_code_names",
        sql: "sql/033",
        powers: null,
        keys: ["code"],
        joins: [],
        blurb: "The public code set, descriptors and all — where NY Medicaid behavioral health lives. Vocabulary only, no rates.",
      },
      {
        name: "nppes_organizations",
        meaning:
          "NPI-2 (organization) identity records from the NPPES monthly dissemination file — NY practice locations plus every NPI that appears as an 'npi:' billing TIN. CMS suppresses EINs in the public file, so this names npi-TINs directly but cannot name ein-TINs on its own.",
        links: "npi ↔ organizations / tin_registry · ein",
        sql: "sql/025",
        powers: null,
        keys: ["npi", "ein"],
        joins: ["nppes_npi", "organizations", "tin_registry", "employers"],
        blurb: "The NPPES organization file — identity records behind org names and npi-type TINs.",
      },
      {
        name: "nppes_other_names",
        meaning:
          "The NPPES Other Name reference file — additional names for NPI-2s, overwhelmingly DBAs ('doing business as'). The display name a patient recognizes usually lives here, not in the opaque Legal Business Name (type_code 3 = DBA). Read by the org-name matcher and the Form 5500 name flywheel.",
        links: "npi → nppes_npi · org-name matcher",
        sql: "sql/030",
        powers: null,
        keys: ["npi"],
        joins: ["nppes_npi", "nppes_organizations", "tin_registry"],
        blurb: "The DBA / 'doing business as' names — the name a patient would actually recognize.",
      },
      {
        name: "nucc_taxonomy",
        meaning:
          "The NUCC Health Care Provider Taxonomy code set (883 codes, v26.0) — the reference that makes a taxonomy code legible (grouping / classification / specialization). Reference/display only; scripts/lib/mh-taxonomy.mjs stays the behavioral-health policy filter.",
        links: "code → provider_qualifications.taxonomy",
        sql: "sql/031",
        powers: null,
        keys: ["code"],
        joins: ["provider_qualifications", "nppes_npi"],
        blurb: "The provider-taxonomy code set — what a taxonomy code actually means. Vocabulary, not a filter.",
      },
    ],
  },
  {
    title: "Insurance graph",
    blurb: "Who is in which network, attested by the payer's own directory.",
    platform: true,
    tables: [
      {
        name: "payer_sources",
        meaning: "The insurers whose FHIR directories we harvest. 'Configured' is not the same as 'live'.",
        links: "id → payer_networks.payer_source_id",
        sql: "sql/013",
        powers: null,
        keys: ["payer_source_id"],
        joins: ["payer_networks", "provider_network_participation", "payer_unmatched_npis"],
        blurb: "The insurers whose directories we pull. Configured is not the same as live.",
      },
      {
        name: "payer_networks",
        meaning: "Per-insurer network/product labels from directories — the labels membership hangs off (anthem 356+ · cigna 226 · uhc 213 · humana 135 · mvp 18).",
        links: "id → provider_network_participation.network_id",
        sql: "sql/013",
        powers: null,
        keys: ["network_id", "payer_source_id"],
        joins: ["payer_sources", "provider_network_participation", "fhir_org_affiliations", "fhir_insurance_plans"],
        blurb: "Every named network/product a payer publishes — the labels membership hangs off.",
      },
      {
        name: "provider_network_participation",
        meaning:
          "Payer-attested membership: one row per (npi × payer × network × location), carrying accepting-new-patients + as-of. THE membership evidence, FHIR flavor — what the insurance badge reads.",
        links: "npi → directory_providers",
        sql: "sql/013",
        powers: DIRECTORY,
        keys: ["npi", "payer_source_id", "network_id"],
        joins: ["directory_providers", "payer_sources", "payer_networks", "provider_participation_summary"],
        blurb: "The payer's own claim that a provider is in a network. This is what the insurance badge reads.",
      },
      {
        name: "payer_unmatched_npis",
        meaning: "Providers a payer names that our book has never heard of — the discovery pool (NYS-40; the big pool still lives in .harvest files).",
        links: "npi (no directory_providers match yet)",
        sql: "sql/013",
        powers: null,
        keys: ["npi", "payer_source_id"],
        joins: ["payer_sources"],
        blurb: "Providers a payer names that our book has never heard of. The discovery pool.",
      },
      {
        name: "fhir_locations",
        meaning: "Practice sites from payer FHIR directories (national, not NY-only) — the addresses behind a network listing.",
        links: "location → healthcare_services, participation",
        sql: "sql/029",
        powers: null,
        keys: ["location"],
        joins: ["fhir_healthcare_services", "provider_network_participation"],
        blurb: "Physical sites a payer publishes — the addresses behind a network listing.",
      },
      {
        name: "fhir_organizations",
        meaning: "Org entities from payer FHIR directories (groups, facilities), as the payer models them.",
        links: "organization → org_affiliations",
        sql: "sql/029",
        powers: null,
        keys: ["organization"],
        joins: ["fhir_org_affiliations"],
        blurb: "The organizations a payer names, as the payer models them.",
      },
      {
        name: "fhir_org_affiliations",
        meaning: "How a payer wires its orgs to its networks (org ↔ network/org relationships as published).",
        links: "organization ↔ network",
        sql: "sql/029",
        powers: null,
        keys: ["organization", "network"],
        joins: ["fhir_organizations", "payer_networks"],
        blurb: "How a payer wires its orgs to its networks.",
      },
      {
        name: "fhir_healthcare_services",
        meaning: "What a payer says is offered where — the payer's own service taxonomy, not ours.",
        links: "location → service",
        sql: "sql/029",
        powers: null,
        keys: ["location"],
        joins: ["fhir_locations"],
        blurb: "What a payer says is offered where — their taxonomy, not ours.",
      },
      {
        name: "fhir_insurance_plans",
        meaning: "The InsurancePlan/product objects payers publish alongside their network labels.",
        links: "plan → network",
        sql: "sql/029",
        powers: null,
        keys: ["network"],
        joins: ["payer_networks"],
        blurb: "The plan objects payers publish alongside their networks.",
      },
      {
        name: "org_affiliations",
        meaning:
          "Payer-attested provider↔org links pulled from the PractitionerRole.organization reference in Anthem/Humana Plan-Net resources (display = the real org name, e.g. 'Lifestance Psychology'). Extracted idempotently from provider_network_participation.raw_resource by scripts/orgs-sync.mjs; re-run after every FHIR harvest.",
        links: "npi → directory_providers · org_ref",
        sql: "sql/025",
        powers: null,
        keys: ["npi", "payer_source_id", "org_ref"],
        joins: ["directory_providers", "payer_sources", "fhir_organizations", "tin_registry"],
        blurb: "The payer's own claim about which org a provider bills under — the named-org layer feeding tin_registry.",
      },
    ],
  },
  {
    title: "Rates (Transparency-in-Coverage)",
    blurb: "What payers actually pay, from their own published machine-readable files.",
    platform: true,
    tables: [
      {
        name: "provider_rate_signals",
        meaning:
          "The rate corpus. One row per (npi × tin × payer × plan/network × CPT × rate × POS × file date). A rate proves a CONTRACT as of a date — never patient cost, never standalone membership.",
        links: "npi, tin, source_file",
        sql: "sql/017",
        powers: RATES,
        keys: ["npi", "tin", "payer", "billing_code", "source_file"],
        joins: ["directory_providers", "tin_registry", "provider_rate_summary", "cpt_codes", "rate_table_mv", "org_tin_rate_summary", "plans"],
        blurb: "The rate corpus. One row = one payer's published price for one code, at one TIN, on one date.",
      },
      {
        name: "provider_rate_summary",
        meaning: "Per-NPI rate rollup (matview) — what each provider is paid, precomputed so /recruiting stays fast.",
        links: "npi (rollup of provider_rate_signals)",
        sql: "sql/021",
        powers: { href: "/recruiting", label: "Recruiting" },
        keys: ["npi"],
        joins: ["provider_rate_signals", "directory_providers"],
        blurb: "One row per provider: what they're paid, precomputed so /recruiting stays fast.",
      },
      {
        name: "provider_participation_summary",
        meaning: "Per-NPI network aggregate (matview) feeding the directory Accepting/Network sort; refresh with the other matviews after every ingest.",
        links: "npi (rollup of provider_network_participation)",
        sql: "sql/023",
        powers: DIRECTORY,
        keys: ["npi"],
        joins: ["provider_network_participation", "directory_providers"],
        blurb: "One row per provider: which networks they're in, precomputed for the directory sort.",
      },
      {
        name: "rate_table_mv",
        meaning: "The published rate table (matview): one row per (payer, TIN) with per-code rates + clinician counts — precomputed, which is why the public page loads instantly.",
        links: "tin, payer → rate_table_child_mv",
        sql: "sql/027",
        powers: PUBLISHED,
        keys: ["tin", "payer"],
        joins: ["rate_table_child_mv", "tin_registry", "org_tin_rosters", "provider_rate_signals"],
        blurb: "The rate table the public page renders — precomputed, which is why it loads instantly.",
      },
      {
        name: "rate_table_child_mv",
        meaning: "Per-network/setting detail rows under each rate_table_mv parent (facility vs office is a real price difference).",
        links: "tin, payer ← rate_table_mv",
        sql: "sql/032",
        powers: PUBLISHED,
        keys: ["tin", "payer", "network"],
        joins: ["rate_table_mv"],
        blurb: "The breakdown under each rate-table row: network and setting.",
      },
      {
        name: "org_tin_rosters",
        meaning: "Per-TIN clinician roster (matview): who bills under each org — the roster behind an org page.",
        links: "tin, npi",
        sql: "sql/025",
        powers: ORGS,
        keys: ["tin", "npi"],
        joins: ["organizations", "directory_providers", "rate_table_mv", "org_tin_rate_summary", "tin_registry"],
        blurb: "Who bills under each organization — the roster behind an org page.",
      },
      {
        name: "org_tin_rate_summary",
        meaning: "Per-(TIN, payer, code) rate percentiles (matview) — what each org is paid at p25/median/p75.",
        links: "tin, payer, billing_code",
        sql: "sql/025",
        powers: ORGS,
        keys: ["tin", "payer", "billing_code"],
        joins: ["org_tin_rosters", "provider_rate_signals"],
        blurb: "What each organization is paid, per payer and code, at p25/median/p75.",
      },
      {
        name: "tin_registry",
        meaning: "TIN → business-name registry: the naming layer behind every org display name. Without it every org reads as a 9-digit number (NYS-27 backfill has run).",
        links: "tin_norm ↔ provider_rate_signals.tin",
        sql: "sql/019",
        powers: ORGS,
        keys: ["tin"],
        joins: ["provider_rate_signals", "organizations", "rate_table_mv", "org_tin_rosters"],
        blurb: "Turns a bare tax ID into a business name. Without it every org reads as a 9-digit number.",
      },
      {
        name: "payer_rate_totals",
        meaning: "Per-payer rate totals (matview) — the small denominator table the admin/observatory reads instead of scanning the multi-million-row corpus.",
        links: "payer (rollup of provider_rate_signals)",
        sql: "sql/026",
        powers: INSIGHTS,
        keys: ["payer"],
        joins: ["provider_rate_signals"],
        blurb: "Per-payer rate totals — the small table the observatory reads instead of scanning the corpus.",
      },
      {
        name: "rate_bands_license_summary",
        meaning:
          "Rate bands by license/profession (matview) — the p25/median/p75 distribution per profession that /rates Bands renders. Part of the sql/024 precompute that took /rates from 20-32s to <0.3s.",
        links: "billing_code (rollup of provider_rate_signals)",
        sql: "sql/024",
        powers: RATES,
        keys: ["billing_code"],
        joins: ["provider_rate_signals"],
        blurb: "Rate percentiles per profession — the precompute behind /rates Bands.",
      },
      {
        name: "rate_bands_payer_summary",
        meaning: "Rate bands by payer (matview) — per-payer percentile bands over the priced codes.",
        links: "payer, billing_code (rollup of provider_rate_signals)",
        sql: "sql/024",
        powers: RATES,
        keys: ["payer", "billing_code"],
        joins: ["provider_rate_signals", "payer_rate_totals"],
        blurb: "Per-payer percentile bands over the priced codes.",
      },
      {
        name: "rate_bands_checked_payers",
        meaning: "The set of payers with enough rows to publish bands (matview) — gates which payers /rates Bands will show.",
        links: "payer (gate over provider_rate_signals)",
        sql: "sql/024",
        powers: RATES,
        keys: ["payer"],
        joins: ["provider_rate_signals"],
        blurb: "Which payers have enough data to show bands — the gate for /rates Bands.",
      },
    ],
  },
  {
    title: "Medicare benchmark (CMS PFS)",
    blurb: "What Medicare itself pays per NY locality — the yardstick every negotiated rate is measured against.",
    platform: true,
    tables: [
      {
        name: "medicare_benchmark_ny",
        meaning:
          "The computed benchmark: what Medicare allows per (NY locality × code), from cms_rvu × cms_gpci × the conversion factor. The denominator every '% of Medicare' number divides by.",
        links: "state+locality_code+code (from cms_rvu · cms_gpci · cms_pfs_config)",
        sql: "sql/033",
        powers: RATES,
        keys: ["code", "locality_code"],
        joins: ["cms_rvu", "cms_gpci", "cms_pfs_config", "provider_rate_signals"],
        blurb: "What Medicare pays here, per code and NY locality. Everything else is priced against this.",
      },
      {
        name: "cms_rvu",
        meaning: "PFS Relative Value File: work/PE/MP RVUs per code × modifier. Deliberately carries NO descriptor column — that text is AMA-licensed to CMS, not to us.",
        links: "hcpcs_code → cpt_codes.code · medicare_benchmark_ny",
        sql: "sql/033",
        powers: null,
        keys: ["code"],
        joins: ["medicare_benchmark_ny", "cpt_codes"],
        blurb: "How much work each code represents, per CMS. The raw input to the benchmark.",
      },
      {
        name: "cms_gpci",
        meaning:
          "Geographic practice cost indices, 109 localities. NY has five (Manhattan · NYC Suburbs/LI · Poughkeepsie · Queens · Rest of NY) — the geography multiplier that makes the same code pay differently in Manhattan and Buffalo.",
        links: "state+locality_code → medicare_benchmark_ny",
        sql: "sql/033",
        powers: null,
        keys: ["locality_code"],
        joins: ["medicare_benchmark_ny"],
        blurb: "The geography multiplier — why the same code pays differently in Manhattan and Buffalo.",
      },
      {
        name: "cms_pfs_config",
        meaning:
          "PFS scalars — the dollars-per-RVU conversion factors that turn relative units into money. CY2026 ships two ($33.4009 non-APM, which the benchmark uses, and $33.5675 for qualifying APM participants).",
        links: "key → medicare_benchmark_ny",
        sql: "sql/033",
        powers: null,
        keys: [],
        joins: ["medicare_benchmark_ny"],
        blurb: "The dollars-per-RVU scalars that turn relative units into money.",
      },
    ],
  },
  {
    title: "Employers & plans",
    blurb: "Which employer buys which plan — the demand side of the rate corpus, and the plan-registry assembly.",
    platform: true,
    tables: [
      {
        name: "employers",
        meaning: "Plan sponsors from the Aetna ToC (EIN-keyed) — the employers behind the plans we hold rates for.",
        links: "ein → plans.employer_ein",
        sql: "sql/020",
        powers: PLANS,
        keys: ["ein"],
        joins: ["plans", "form5500_filings"],
        blurb: "The employers sponsoring the plans we hold rates for.",
      },
      {
        name: "plans",
        meaning: "Employer plans; each points at a network product. The plan catalog (display cleanup NYS-44).",
        links: "source_file → provider_rate_signals.source_file",
        sql: "sql/020",
        powers: PLANS,
        keys: ["employer_ein", "source_file"],
        joins: ["employers", "provider_rate_signals"],
        blurb: "The plan catalog — each one ties an employer to a network product and its rate file.",
      },
      {
        name: "form5500_filings",
        meaning:
          "DOL/EFAST2 Form 5500 health/welfare filings — the de-facto plan registry (the HPID never shipped). EIN-keyed, joins straight onto employers/plans/tin_registry (NYS-101).",
        links: "ein → employers · form5500_schedule_a",
        sql: "sql/040",
        powers: null,
        keys: ["ein"],
        joins: ["employers", "form5500_schedule_a", "tin_registry"],
        blurb: "The federal plan registry — DOL Form 5500 filings, the record behind the ToC-derived employer.",
      },
      {
        name: "form5500_schedule_a",
        meaning: "Schedule A insurance-contract rows under each 5500 filing — the named carrier + covered-lives behind a plan.",
        links: "ein → form5500_filings",
        sql: "sql/040",
        powers: null,
        keys: ["ein"],
        joins: ["form5500_filings"],
        blurb: "The named carrier + covered-lives behind each Form 5500 filing.",
      },
    ],
  },
  {
    title: "Maintenance & platform",
    blurb: "The ledger and notification tables the automation writes to.",
    platform: true,
    tables: [
      {
        name: "sync_runs",
        meaning:
          "The maintenance ledger: one row per run of the nightly matview cron ('daily') and the harvest runner ('harvest:<id>'). The /insights sync-health card + run-history table read it.",
        links: "job, started_at (no fk)",
        sql: "sql/035",
        powers: INSIGHTS,
        keys: [],
        joins: [],
        blurb: "The run ledger — every nightly cron and harvest run, with status and timing.",
      },
      {
        name: "notifications",
        meaning: "Per-user in-app notifications (v1 kind: sync_failure) — the rows behind the TopBar bell (NYS-100). No PHI: pipeline rows name jobs and tables only.",
        links: "user_id → users",
        sql: "sql/038",
        powers: null,
        keys: ["user_id"],
        joins: ["users"],
        blurb: "The rows behind the TopBar bell — pipeline alerts, no PHI.",
      },
    ],
  },
  {
    title: "Practice management (EHR)",
    blurb: "The practice's own records. PHI — the atlas prints structure and counts, never contents.",
    platform: false,
    tables: [
      {
        name: "users",
        meaning: "Login accounts: staff (admin/practitioner) and client portal users; soft-deleted via deleted_at.",
        links: "id → practitioner/author refs across appointments, notes, messages, files",
        sql: "sql/001",
        powers: null,
        keys: ["user_id"],
        joins: ["clients", "appointments", "notifications"],
      },
      {
        name: "clients",
        meaning: "Patient/client records; user_id links an optional portal login. PHI.",
        links: "id → appointments, invoices, notes, messages, files, insurance_policies",
        sql: "sql/001",
        powers: null,
        keys: ["client_id"],
        joins: ["users", "appointments", "invoices", "notes", "messages", "files", "insurance_policies"],
      },
      {
        name: "appointments",
        meaning: "Calendar events tying client + practitioner + service + location with a status lifecycle.",
        links: "client_id, practitioner_id",
        sql: "sql/001",
        powers: null,
        keys: ["client_id"],
        joins: ["clients", "users"],
      },
      {
        name: "invoices",
        meaning: "Client invoices with human numbers (INV-2026-0001) and a draft→sent→paid/overdue/void lifecycle.",
        links: "client_id",
        sql: "sql/001",
        powers: null,
        keys: ["client_id"],
        joins: ["clients"],
      },
      {
        name: "notes",
        meaning: "Clinical documentation (soft-deleted, sign-and-lock lifecycle). PHI.",
        links: "client_id",
        sql: "sql/001",
        powers: null,
        keys: ["client_id"],
        joins: ["clients"],
      },
      {
        name: "messages",
        meaning: "Individual secure messages within a thread; read_at marks recipient receipt. PHI.",
        links: "thread_id → threads.client_id",
        sql: "sql/001",
        powers: null,
        keys: ["client_id"],
        joins: ["clients"],
      },
      {
        name: "files",
        meaning: "Client documents: portal uploads, rendered form PDFs, generated superbills. PHI.",
        links: "client_id",
        sql: "sql/001",
        powers: null,
        keys: ["client_id"],
        joins: ["clients"],
      },
      {
        name: "payers",
        meaning: "Insurance companies for BILLING (name + clearinghouse code) — distinct from payer_sources (the directory harvest side).",
        links: "id → insurance_policies.payer_id",
        sql: "sql/001",
        powers: null,
        keys: ["payer_id"],
        joins: ["insurance_policies"],
      },
      {
        name: "insurance_policies",
        meaning: "A client's coverage with a payer (member/group ids, verification status, copay). PHI.",
        links: "client_id, payer_id",
        sql: "sql/001",
        powers: null,
        keys: ["client_id", "payer_id"],
        joins: ["clients", "payers"],
      },
    ],
  },
];

/** Flat name→table lookup with the domain title attached, for consumers that
 *  resolve a single relation (db-atlas's META, admin's per-name facts). */
export const TABLE_BY_NAME = new Map(
  TABLE_GROUPS.flatMap((g) => g.tables.map((t) => [t.name, { ...t, domain: g.title }])),
);

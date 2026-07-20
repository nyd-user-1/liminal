// Harvest anatomy — the static ledger behind the Harvest Runs dialog
// (TASK-WORKSPACE-V4 T3). Two questions per job: what it downloads, and — for MRF
// jobs — which fields of the CMS Transparency-in-Coverage schema our scanner keeps
// vs. leaves behind. Nothing here is read at request time: manifests and the
// scanner source are transcribed into these constants so the dialog is instant and
// server-safe.
//
// THE FIELD TREE IS THE CANON-VS-HARVESTED LEDGER. Every node is a real field from
// the CMS price-transparency-guide schema (github.com/CMSgov/price-transparency-
// guide — the in-network-rates and table-of-contents READMEs, both wire versions
// we meet: v1.3.1 and v2.0). `harvested: true` ⇔ our scanner extracts it; the marks
// are transcribed from scripts/mrf/scan-tic.mjs, cited inline by line. Count the
// blanks to count the divergence.

export interface CanonField {
  name: string;
  /** Schema type, as the CMS README states it. */
  type: string;
  /** true when required by the CMS schema. */
  required?: boolean;
  /** true ⇔ our scanner (or, for the ToC, our manifest-mint step) keeps it. */
  harvested: boolean;
  /** Where a harvested field lands — the rate column, or a downstream layer. */
  lands?: string;
  /** Why it's ignored, or how a non-column field is used. */
  note?: string;
  children?: CanonField[];
}

// ── in-network-rates schema (the file the scanner reads) ─────────────────────
// Marks transcribed from scripts/mrf/scan-tic.mjs. Scanner CSV columns (line 168):
//   npi,payer,plan_or_network,billing_code,negotiated_rate,negotiated_type,
//   billing_class,place_of_service,tin,source_file,file_date
export const IN_NETWORK_SCHEMA: CanonField = {
  name: "(in-network-rates file)",
  type: "object",
  harvested: true,
  note: "root",
  children: [
    {
      name: "reporting_entity_name",
      type: "string",
      required: true,
      harvested: true,
      lands: "payer",
      note: "captured from the header; becomes the payer column under --payer=auto (scan-tic:714)",
    },
    { name: "reporting_entity_type", type: "string", required: true, harvested: false },
    { name: "issuer_name", type: "string", harvested: false },
    {
      name: "plan_name",
      type: "string",
      harvested: false,
      note: "the employer plan is read from the table-of-contents file, not here",
    },
    { name: "plan_id_type", type: "string", harvested: false },
    { name: "plan_id", type: "string", harvested: false },
    { name: "plan_sponsor_name", type: "string", harvested: false },
    { name: "plan_market_type", type: "string", harvested: false },
    {
      name: "last_updated_on",
      type: "string",
      required: true,
      harvested: false,
      note: "rows are dated from the manifest file_date instead",
    },
    { name: "version", type: "string", required: true, harvested: false, note: "we meet v1.3.1 and v2.0" },
    {
      name: "provider_references[]",
      type: "array",
      required: true,
      harvested: true,
      note: "the group dictionary — parsed up front, bounded by our NPI list (scan-tic:228)",
      children: [
        {
          name: "provider_group_id",
          type: "number",
          required: true,
          harvested: true,
          note: "join key: rate → group (scan-tic:265)",
        },
        {
          name: "network_name[]",
          type: "array",
          required: true,
          harvested: true,
          lands: "plan_or_network",
          note: "per-network label under --network=auto (scan-tic:264)",
        },
        {
          name: "location",
          type: "string",
          harvested: false,
          note: "v2.0 remote provider-reference URL — not followed",
        },
        {
          name: "provider_groups[]",
          type: "array",
          required: true,
          harvested: true,
          children: [
            {
              name: "npi[]",
              type: "array<number>",
              required: true,
              harvested: true,
              lands: "npi",
              note: "kept only where it matches our NPI list (scan-tic:242)",
            },
            {
              name: "tin",
              type: "object",
              required: true,
              harvested: true,
              children: [
                { name: "type", type: "string", required: true, harvested: true, lands: "tin", note: "type:value (scan-tic:131)" },
                { name: "value", type: "string", required: true, harvested: true, lands: "tin", note: "type:value (scan-tic:131)" },
                {
                  name: "business_name",
                  type: "string",
                  harvested: true,
                  lands: "tin_registry",
                  note: "the only authoritative name for an EIN — sidecar to sql/019 (scan-tic:149)",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "in_network[]",
      type: "array",
      required: true,
      harvested: true,
      note: "the items — walked one at a time (scan-tic:518)",
      children: [
        {
          name: "negotiation_arrangement",
          type: "string",
          required: true,
          harvested: false,
          note: "read as the item-boundary key; the value (ffs/bundle/capitation) is not kept",
        },
        { name: "name", type: "string", required: true, harvested: false },
        { name: "billing_code_type", type: "string", required: true, harvested: false },
        { name: "billing_code_type_version", type: "string", required: true, harvested: false },
        { name: "severity_of_illness", type: "string", harvested: false },
        {
          name: "billing_code",
          type: "string",
          required: true,
          harvested: true,
          lands: "billing_code",
          note: "matched against our ~20-code panel unless --codes=all (scan-tic:89)",
        },
        { name: "description", type: "string", required: true, harvested: false },
        {
          name: "bundled_codes[]",
          type: "array",
          harvested: false,
          note: "bundle arrangement — outside our panel",
        },
        {
          name: "covered_services[]",
          type: "array",
          harvested: false,
          note: "capitation arrangement — outside our panel",
        },
        {
          name: "negotiated_rates[]",
          type: "array",
          required: true,
          harvested: true,
          children: [
            {
              name: "provider_references[]",
              type: "array<number>",
              required: true,
              harvested: true,
              note: "the group-ids this rate applies to (scan-tic:283)",
            },
            {
              name: "provider_groups[]",
              type: "array",
              harvested: true,
              note: "inline groups, when a file carries no provider_references section (scan-tic:287)",
            },
            {
              name: "negotiated_prices[]",
              type: "array",
              required: true,
              harvested: true,
              note: "singular negotiated_price (CDPHP/HCP) is normalized in too (scan-tic:303)",
              children: [
                { name: "negotiated_type", type: "string", required: true, harvested: true, lands: "negotiated_type" },
                { name: "negotiated_rate", type: "number", required: true, harvested: true, lands: "negotiated_rate" },
                { name: "expiration_date", type: "string", required: true, harvested: false },
                {
                  name: "service_code[]",
                  type: "array",
                  harvested: true,
                  lands: "place_of_service",
                  note: "the CMS place-of-service codes, pipe-joined (scan-tic:311)",
                },
                { name: "billing_class", type: "string", required: true, harvested: true, lands: "billing_class" },
                { name: "setting", type: "string", required: true, harvested: false },
                { name: "billing_code_modifier[]", type: "array", harvested: false },
                { name: "additional_information", type: "string", harvested: false },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// The two rate columns that come from the manifest line, not the JSON — shown so
// every scanner column traces to a checked source.
export const MANIFEST_FIELDS: CanonField[] = [
  {
    name: "source_file",
    type: "string",
    harvested: true,
    lands: "source_file",
    note: "the manifest slug — the runner stamps it (--source-file)",
  },
  {
    name: "file_date",
    type: "string",
    harvested: true,
    lands: "file_date",
    note: "the manifest file-date — the runner stamps it (--file-date)",
  },
];

// ── table-of-contents schema (read by a human at manifest-mint time) ─────────
// The scanner never touches ToC files. A ✓ here means the field FEEDS A DOWNSTREAM
// LAYER when we mint a manifest — not that scan-tic extracts it. Pointers name where.
export const TOC_SCHEMA: CanonField = {
  name: "(table-of-contents file)",
  type: "object",
  harvested: true,
  note: "root — walked by hand to mint manifests, not by the scanner",
  children: [
    { name: "reporting_entity_name", type: "string", required: true, harvested: false },
    { name: "reporting_entity_type", type: "string", required: true, harvested: false },
    { name: "last_updated_on", type: "string", required: true, harvested: false },
    { name: "version", type: "string", required: true, harvested: false, note: "we meet v1.3.1 and v2.0" },
    {
      name: "reporting_structure[]",
      type: "array",
      required: true,
      harvested: true,
      children: [
        {
          name: "reporting_plans[]",
          type: "array",
          required: true,
          harvested: true,
          children: [
            { name: "plan_name", type: "string", required: true, harvested: true, lands: "/plans" },
            { name: "issuer_name", type: "string", required: true, harvested: true, lands: "/plans" },
            { name: "plan_id_type", type: "string", required: true, harvested: false },
            { name: "plan_id", type: "string", required: true, harvested: true, lands: "/plans" },
            { name: "plan_sponsor_name", type: "string", harvested: false },
            { name: "plan_market_type", type: "string", required: true, harvested: false },
          ],
        },
        {
          name: "in_network_files[]",
          type: "array",
          harvested: true,
          children: [
            { name: "description", type: "string", required: true, harvested: false },
            {
              name: "location",
              type: "string",
              required: true,
              harvested: true,
              lands: "manifest",
              note: "the download URL a manifest line is minted from",
            },
          ],
        },
        {
          name: "allowed_amount_file",
          type: "object",
          harvested: false,
          note: "allowed-amounts files are skipped wholesale — see footnotes",
          children: [
            { name: "description", type: "string", required: true, harvested: false },
            { name: "location", type: "string", required: true, harvested: false },
          ],
        },
      ],
    },
  ],
};

// Footnotes shown under the field tree — the scope rulings the marks encode.
export const ANATOMY_FOOTNOTES: string[] = [
  "Allowed-amounts files (the out-of-network companion) are skipped wholesale — we harvest in-network rates only.",
  "Billing codes outside our ~20-code behavioral panel are ignored unless a rescan runs --codes=all (NYS-50 breadth ruling).",
  "The table-of-contents file is read by hand to mint manifests; the scanner reads only the in-network-rates file it points to.",
];

// ── per-job "what it downloads" ──────────────────────────────────────────────

export interface JobAnatomy {
  kind: "mrf" | "recurring" | "unknown";
  /** Plain-language job title. */
  title: string;
  /** MRF: what the manifest pulls + roughly how many files. Recurring: the memo. */
  summary: string;
  /** MRF: the decompress/scan pipeline. */
  pipeline?: string;
  /** Recurring: script path + what it reads / writes. */
  script?: string;
  reads?: string;
  writes?: string;
}

/** Recurring (non-MRF) harvest jobs — memos + reads/writes from ops/harvest/jobs.json
 *  and docs/ops/SCRIPTS.md. Keyed by the sync_runs job id sans the "harvest:" prefix. */
const RECURRING: Record<string, Omit<JobAnatomy, "kind">> = {
  "rates-rollup": {
    title: "Rate-coverage rollup",
    summary: "Read-only morning coverage report — the log is the deliverable.",
    script: "scripts/mrf/rollup.mjs",
    reads: "provider_rate_signals + participation summaries",
    writes: "nothing — stdout report only",
  },
  "fhir-status": {
    title: "FHIR directory status",
    summary: "Directory-side coverage snapshot across the payer FHIR endpoints (runs each query through a psql subprocess to dodge the undici 300s ceiling).",
    script: ".harvest/status.mjs",
    reads: "payer FHIR endpoints + provider_network_participation",
    writes: "nothing — snapshot log only",
  },
  "nppes-weekly": {
    title: "NPPES weekly delta",
    summary: "Discover, download, and apply the CMS weekly NPPES delta + deactivations (already-applied files are skipped, so re-runs are free).",
    script: "ops/harvest/tasks/nppes-weekly.sh",
    reads: "CMS NPPES weekly delta files",
    writes: "directory_providers (+ deactivations)",
  },
  "probe-payers": {
    title: "Payer capability probe",
    summary: "Read-only reachability probe (≤2 GETs per payer) — keeps payer reachability honest.",
    script: "scripts/probe-payers.mjs",
    reads: "≤2 GETs per payer source",
    writes: "payer_sources.last_probe_result",
  },
  "db-atlas": {
    title: "Database atlas",
    summary: "Regenerate the database atlas from the live schema.",
    script: "scripts/db-atlas.mjs",
    reads: "the live Postgres schema",
    writes: "docs/data/DATABASE.md + the Obsidian atlas",
  },
};

/** MRF payer families — manifest download shape + pipeline, transcribed from
 *  .harvest/mrf/manifests/. Keyed by the longest slug token that appears in the
 *  harvest job id (mirrors job-descriptions.ts's PAYER_SLUG resolution). */
const MRF_PAYERS: Array<{ keys: string[]; title: string; summary: string; pipeline: string }> = [
  {
    keys: ["uhc", "oxford"],
    title: "UnitedHealthcare / Oxford",
    summary: "8 proven UHC/Oxford in-network files (~35.6 GB) off the UHC blobs API — every behavioral product at the 2026-07-01 vintage.",
    pipeline: "gzip stream → scan-tic (20-code panel, id-last refs=stream)",
  },
  {
    keys: ["anthem", "empire"],
    title: "Empire BCBS / Anthem",
    summary: "Empire NY sharded in-network files (the 39/05/06-series) off empirebcbs.mrf.bcbs.com signed URLs — the ref-dense books.",
    pipeline: "gzip stream → two-pass scan-tic (collect-gids then gids, NYS-25)",
  },
  {
    keys: ["metroplus"],
    title: "MetroPlus",
    summary: "3 MetroPlus in-network files (FFS · Gold GoldCare · QHP Exchange) off the Azure MRF blob store.",
    pipeline: "uncompressed JSON → scan-tic",
  },
  {
    keys: ["cdphp"],
    title: "CDPHP",
    summary: "3 CDPHP in-network files (HMO · CDPHN · UBI self-funded) off the CDPHP S3 bucket.",
    pipeline: "zip → scan-tic (singular negotiated_price normalized)",
  },
  {
    keys: ["emblem"],
    title: "EmblemHealth (HIP/GHI)",
    summary: "2 EmblemHealth in-network files (Beacon/Carelon commercial · HCP network) off the Emblem transparency portal.",
    pipeline: "uncompressed JSON → scan-tic (Carelon v2.0 quote-repair)",
  },
  {
    keys: ["fidelis"],
    title: "Fidelis Care (Centene)",
    summary: "2 Fidelis in-network files (Exchange · Essential) off the Centene corporate CDN.",
    pipeline: "uncompressed JSON → scan-tic",
  },
  {
    keys: ["mvp"],
    title: "MVP Health Care",
    summary: "MVP in-network rate files off the MVP MRF host.",
    pipeline: "gzip stream → scan-tic",
  },
  {
    keys: ["oscar"],
    title: "Oscar Health (Optum BH)",
    summary: "Oscar behavioral books (Optum BH carve-out) off Oscar's TiC S3 bucket — the refs-LAST generator.",
    pipeline: "zip refs-last (ziprl) → scan-tic (--payer explicit)",
  },
  {
    keys: ["healthfirst"],
    title: "Healthfirst",
    summary: "Healthfirst in-network rate files.",
    pipeline: "→ scan-tic",
  },
  {
    keys: ["excellus"],
    title: "Excellus BCBS",
    summary: "Excellus in-network rate files off the BCBS MRF host.",
    pipeline: "gzip stream → scan-tic",
  },
  {
    keys: ["highmark"],
    title: "Independent Health / Highmark",
    summary: "Highmark / Independent Health in-network files off the BCBS MRF host.",
    pipeline: "gzip stream → scan-tic",
  },
  {
    keys: ["cigna"],
    title: "Cigna",
    summary: "Cigna in-network rate files (sharded) off the Cigna MRF host.",
    pipeline: "gzip stream → scan-tic",
  },
];

const MRF_RE = /^harvest:mrf-(?:wide-|stream-|2p-)?(.+)$/;

/** Resolve a sync_runs job id to its anatomy. MRF jobs match a payer family by
 *  slug; the fixed recurring jobs match by id; anything else is described plainly. */
export function jobAnatomy(job: string): JobAnatomy {
  const bare = job.replace(/^harvest:/, "");
  const recurring = RECURRING[bare];
  if (recurring) return { kind: "recurring", ...recurring };

  const m = job.match(MRF_RE);
  const slug = m ? m[1] : bare;
  const payer = MRF_PAYERS.find((p) => p.keys.some((k) => slug.includes(k)));
  if (payer) {
    return { kind: "mrf", title: payer.title, summary: payer.summary, pipeline: payer.pipeline };
  }

  // Unrecognized MRF manifest — still an in-network harvest, we just don't have a
  // transcribed download summary. The field ledger below still applies.
  if (m) {
    return {
      kind: "mrf",
      title: slug.replace(/-/g, " "),
      summary: "In-network rate file harvest (manifest not transcribed here).",
      pipeline: "→ scan-tic → load-rate-signals",
    };
  }
  return { kind: "unknown", title: bare.replace(/-/g, " "), summary: "Recurring harvest job." };
}

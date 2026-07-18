#!/usr/bin/env node
// db-atlas.mjs — the Database Atlas generator. READ-ONLY introspection of the
// live schema → docs/data/DATABASE.md + one Obsidian note per table (with
// [[wiki-links]] between joined tables, so the founder's graph view shows the
// schema).
//
//   node --env-file=.env.local scripts/db-atlas.mjs
//
// It never writes to the database. Three cheap round trips do the whole job:
//   1. pg_class    — every public table + matview, its kind, and the planner's
//                    row ESTIMATE (reltuples). We never count(*) the 9M-row
//                    tables; big relations report the estimate, small ones get
//                    an exact count in one batched query.
//   2. pg_attribute — every column of every table AND matview (matviews are
//                     absent from information_schema.columns, so this is the
//                     one source that covers both).
//   3. pg_constraint — foreign keys, merged into the hand-maintained join graph.
//
// The domain grouping, per-table meaning, and "which page consumes it" metadata
// below MIRROR lib/repos/admin.ts (platformInventory) — that repo function is
// the app's authority (it powers /insights' Observatory and /admin/data); this
// is the atlas's copy of the same knowledge. Keep them in step: a table added
// there wants a line here. Tables present in the DB but absent from the metadata
// still appear, under "Unmapped tables", with their columns and count — so the
// atlas can never silently omit something the schema grew.
//
// The matview refresh registry is READ from the nightly cron itself
// (app/api/cron/daily/route.ts VIEWS array) rather than restated, so this stays
// honest if that list changes.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_MD = path.join(ROOT, "docs", "data", "DATABASE.md");
const VAULT_DIR = path.join(os.homedir(), "Vaults", "hq", "liminal", "atlas");
const CRON_ROUTE = path.join(ROOT, "app", "api", "cron", "daily", "route.ts");
const BIG_ROW_THRESHOLD = 500_000; // above this we trust the estimate, never count(*)
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — run with node --env-file=.env.local scripts/db-atlas.mjs");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

// ── the metadata: a mirror of lib/repos/admin.ts buildDictionaryGroups ────────
// Each table: meaning (one sentence), powers (the page it feeds), joins (the
// tables it links to in the graph), keys (the columns those joins ride on), and
// sql (the numbered migration that defines it). Matviews are detected from the
// catalog, not declared. Join edges are undirected — declaring A→B is enough.
const GROUPS = [
  {
    title: "Who exists (foundation)",
    blurb: "The provider book everything else keys on. One clinician, one NPI, many sources.",
    tables: [
      { name: "directory_providers", sql: "sql/003", meaning: "NY behavioral-health provider book; one row per (source, source_id). Rows exceed distinct NPIs because one clinician arrives from several sources (person-level merge is NYS-34).", powers: "/directory", keys: ["npi"], joins: ["nppes_npi", "provider_qualifications", "provider_network_participation", "provider_rate_signals", "provider_rate_summary", "provider_participation_summary", "org_tin_rosters"] },
      { name: "directory_programs", sql: "sql/003", meaning: "OMH state-licensed treatment programs — the clinics, not the clinicians.", powers: "/programs", keys: ["county"], joins: [] },
      { name: "provider_qualifications", sql: "sql/028", meaning: "Per-NPI licenses, degrees and taxonomies — the source of the profession + credential filters. Licensing, not what a provider treats.", powers: "/directory", keys: ["npi"], joins: ["directory_providers", "nppes_npi"] },
      { name: "nppes_npi", sql: "sql/030", meaning: "The raw national NPPES registry as loaded — every provider in the country, all specialties. directory_providers is the NY behavioral-health distillation of it.", powers: "/directory", keys: ["npi"], joins: ["directory_providers", "organizations", "provider_qualifications"] },
      { name: "organizations", sql: "sql/034", meaning: "NPI-2 org book: every NY organization + national platforms (Headway, Alma). Derived in SQL from nppes_npi; some are also billing TINs — the first NPI-2 ↔ billing-TIN join.", powers: "/directory", keys: ["npi", "tin"], joins: ["nppes_npi", "tin_registry", "org_tin_rosters"] },
      { name: "cpt_codes", sql: "sql/050", meaning: "OUR OWN plain-language names for the behavioral billing codes — never AMA descriptor text, which is licensed. The live codes match RATE_CODES in lib/rate-table.ts.", powers: null, keys: ["code"], joins: ["provider_rate_signals", "cms_rvu"] },
      { name: "hcpcs_codes", sql: "sql/033", meaning: "CMS HCPCS Level II with OFFICIAL descriptors (public, unlike CPT). Where NY Medicaid behavioral codes live (H0004/H0015/H2019). Vocabulary only — we hold zero rates for these.", powers: null, keys: ["code"], joins: [] },
    ],
  },
  {
    title: "Insurance graph",
    blurb: "Who is in which network, attested by the payer's own FHIR directory.",
    tables: [
      { name: "payer_sources", sql: "sql/013", meaning: "The insurers whose FHIR directories we harvest. 'Configured' is not the same as 'live'.", powers: null, keys: ["payer_source_id"], joins: ["payer_networks", "provider_network_participation", "payer_unmatched_npis"] },
      { name: "payer_networks", sql: "sql/013", meaning: "Per-insurer network/product labels from directories — the labels membership hangs off.", powers: null, keys: ["network_id", "payer_source_id"], joins: ["payer_sources", "provider_network_participation", "fhir_org_affiliations", "fhir_insurance_plans"] },
      { name: "provider_network_participation", sql: "sql/013", meaning: "Payer-attested membership: one row per (npi × payer × network × location), carrying accepting-new-patients + as-of. THE membership evidence, FHIR flavor — what the insurance badge reads.", powers: "/directory", keys: ["npi", "payer_source_id", "network_id"], joins: ["directory_providers", "payer_sources", "payer_networks", "provider_participation_summary"] },
      { name: "payer_unmatched_npis", sql: "sql/013", meaning: "Providers a payer names that our book has never heard of — the discovery pool (NYS-40).", powers: null, keys: ["npi", "payer_source_id"], joins: ["payer_sources"] },
      { name: "fhir_locations", sql: "sql/029", meaning: "Practice sites from payer FHIR directories (national, not NY-only) — the addresses behind a network listing.", powers: null, keys: ["location"], joins: ["fhir_healthcare_services", "provider_network_participation"] },
      { name: "fhir_organizations", sql: "sql/029", meaning: "Org entities from payer FHIR directories (groups, facilities), as the payer models them.", powers: null, keys: ["organization"], joins: ["fhir_org_affiliations"] },
      { name: "fhir_org_affiliations", sql: "sql/029", meaning: "How a payer wires its orgs to its networks (org ↔ network/org relationships as published).", powers: null, keys: ["organization", "network"], joins: ["fhir_organizations", "payer_networks"] },
      { name: "fhir_healthcare_services", sql: "sql/029", meaning: "What a payer says is offered where — the payer's own service taxonomy, not ours.", powers: null, keys: ["location"], joins: ["fhir_locations"] },
      { name: "fhir_insurance_plans", sql: "sql/029", meaning: "The InsurancePlan/product objects payers publish alongside their network labels.", powers: null, keys: ["network"], joins: ["payer_networks"] },
    ],
  },
  {
    title: "Rates (Transparency-in-Coverage)",
    blurb: "What payers actually pay, from their own published machine-readable files.",
    tables: [
      { name: "provider_rate_signals", sql: "sql/017", meaning: "The rate corpus. One row per (npi × tin × payer × plan/network × CPT × rate × POS × file date). A rate proves a CONTRACT as of a date — never patient cost, never standalone membership.", powers: "/rates", keys: ["npi", "tin", "payer", "billing_code", "source_file"], joins: ["directory_providers", "tin_registry", "provider_rate_summary", "cpt_codes", "rate_table_mv", "org_tin_rate_summary", "plans"] },
      { name: "provider_rate_summary", sql: "sql/021", meaning: "Per-NPI rate rollup (matview) — what each provider is paid, precomputed so /recruiting stays fast.", powers: "/recruiting", keys: ["npi"], joins: ["provider_rate_signals", "directory_providers"] },
      { name: "provider_participation_summary", sql: "sql/023", meaning: "Per-NPI network aggregate (matview) feeding the directory Accepting/Network sort.", powers: "/directory", keys: ["npi"], joins: ["provider_network_participation", "directory_providers"] },
      { name: "rate_table_mv", sql: "sql/027", meaning: "The published rate table (matview): one row per (payer, TIN) with per-code rates + clinician counts — precomputed, which is why the public page loads instantly.", powers: "/published-rates", keys: ["tin", "payer"], joins: ["rate_table_child_mv", "tin_registry", "org_tin_rosters", "provider_rate_signals"] },
      { name: "rate_table_child_mv", sql: "sql/032", meaning: "Per-network/setting detail rows under each rate_table_mv parent (facility vs office is a real price difference).", powers: "/published-rates", keys: ["tin", "payer", "network"], joins: ["rate_table_mv"] },
      { name: "org_tin_rosters", sql: "sql/025", meaning: "Per-TIN clinician roster (matview): who bills under each org — the roster behind an org page.", powers: "/orgs", keys: ["tin", "npi"], joins: ["organizations", "directory_providers", "rate_table_mv", "org_tin_rate_summary", "tin_registry"] },
      { name: "org_tin_rate_summary", sql: "sql/025", meaning: "Per-(TIN, payer, code) rate percentiles (matview) — what each org is paid at p25/median/p75.", powers: "/orgs", keys: ["tin", "payer", "billing_code"], joins: ["org_tin_rosters", "provider_rate_signals"] },
      { name: "tin_registry", sql: "sql/019", meaning: "TIN → business-name registry: the naming layer behind every org display name. Without it every org reads as a 9-digit number.", powers: "/orgs", keys: ["tin"], joins: ["provider_rate_signals", "organizations", "rate_table_mv", "org_tin_rosters"] },
      { name: "payer_rate_totals", sql: "sql/026", meaning: "Per-payer rate totals (matview) — the small denominator table the admin/observatory reads instead of scanning the 9M-row corpus.", powers: "/insights", keys: ["payer"], joins: ["provider_rate_signals"] },
      { name: "rate_bands_license_summary", sql: "sql/024", meaning: "Rate bands by license/profession (matview) — the p25/median/p75 distribution per profession that /rates Bands renders. Part of the sql/024 precompute that took /rates from 20-32s to <0.3s.", powers: "/rates", keys: ["billing_code"], joins: ["provider_rate_signals"] },
      { name: "rate_bands_payer_summary", sql: "sql/024", meaning: "Rate bands by payer (matview) — per-payer percentile bands over the priced codes.", powers: "/rates", keys: ["payer", "billing_code"], joins: ["provider_rate_signals", "payer_rate_totals"] },
      { name: "rate_bands_checked_payers", sql: "sql/024", meaning: "The set of payers with enough rows to publish bands (matview) — gates which payers /rates Bands will show.", powers: "/rates", keys: ["payer"], joins: ["provider_rate_signals"] },
    ],
  },
  {
    title: "Medicare benchmark (CMS PFS)",
    blurb: "What Medicare itself pays per NY locality — the yardstick every negotiated rate is measured against.",
    tables: [
      { name: "medicare_benchmark_ny", sql: "sql/033", meaning: "The computed benchmark: what Medicare allows per (NY locality × code), from cms_rvu × cms_gpci × the conversion factor. The denominator every '% of Medicare' number divides by.", powers: "/rates", keys: ["code", "locality_code"], joins: ["cms_rvu", "cms_gpci", "cms_pfs_config", "provider_rate_signals"] },
      { name: "cms_rvu", sql: "sql/033", meaning: "PFS Relative Value File: work/PE/MP RVUs per code × modifier. Deliberately carries NO descriptor column — that text is AMA-licensed.", powers: null, keys: ["code"], joins: ["medicare_benchmark_ny", "cpt_codes"] },
      { name: "cms_gpci", sql: "sql/033", meaning: "Geographic practice cost indices, 109 localities. NY has five — the geography multiplier that makes the same code pay differently in Manhattan and Buffalo.", powers: null, keys: ["locality_code"], joins: ["medicare_benchmark_ny"] },
      { name: "cms_pfs_config", sql: "sql/033", meaning: "PFS scalars — the dollars-per-RVU conversion factors that turn relative units into money.", powers: null, keys: [], joins: ["medicare_benchmark_ny"] },
    ],
  },
  {
    title: "Employers & plans",
    blurb: "Which employer buys which plan — the demand side of the rate corpus, and the plan-registry assembly.",
    tables: [
      { name: "employers", sql: "sql/020", meaning: "Plan sponsors from the Aetna ToC (EIN-keyed) — the employers behind the plans we hold rates for.", powers: "/plans", keys: ["ein"], joins: ["plans", "form5500_filings"] },
      { name: "plans", sql: "sql/020", meaning: "Employer plans; each points at a network product. The plan catalog (display cleanup NYS-44).", powers: "/plans", keys: ["employer_ein", "source_file"], joins: ["employers", "provider_rate_signals"] },
      { name: "form5500_filings", sql: "sql/040", meaning: "DOL/EFAST2 Form 5500 health/welfare filings — the de-facto plan registry (the HPID never shipped). EIN-keyed, joins straight onto employers/plans/tin_registry (NYS-101).", powers: null, keys: ["ein"], joins: ["employers", "form5500_schedule_a", "tin_registry"] },
      { name: "form5500_schedule_a", sql: "sql/040", meaning: "Schedule A insurance-contract rows under each 5500 filing — the named carrier + covered-lives behind a plan.", powers: null, keys: ["ein"], joins: ["form5500_filings"] },
    ],
  },
  {
    title: "Maintenance & platform",
    blurb: "The ledger and notification tables the automation writes to.",
    tables: [
      { name: "sync_runs", sql: "sql/035", meaning: "The maintenance ledger: one row per run of the nightly matview cron ('daily') and the harvest runner ('harvest:<id>'). The /insights sync-health card reads it.", powers: "/insights", keys: [], joins: [] },
      { name: "notifications", sql: "sql/038", meaning: "Per-user in-app notifications (v1 kind: sync_failure) — the rows behind the TopBar bell (NYS-100). No PHI: pipeline rows name jobs and tables only.", powers: null, keys: ["user_id"], joins: ["users"] },
    ],
  },
  {
    title: "Practice management (EHR)",
    blurb: "The practice's own records. PHI — the atlas prints structure and counts, never contents.",
    tables: [
      { name: "users", sql: "sql/001", meaning: "Login accounts: staff (admin/practitioner) and client portal users; soft-deleted via deleted_at.", powers: null, keys: ["user_id"], joins: ["clients", "appointments", "notifications"] },
      { name: "clients", sql: "sql/001", meaning: "Patient/client records; user_id links an optional portal login. PHI.", powers: null, keys: ["client_id"], joins: ["users", "appointments", "invoices", "notes", "messages", "files", "insurance_policies"] },
      { name: "appointments", sql: "sql/001", meaning: "Calendar events tying client + practitioner + service + location with a status lifecycle.", powers: null, keys: ["client_id"], joins: ["clients", "users"] },
      { name: "invoices", sql: "sql/001", meaning: "Client invoices with human numbers (INV-2026-0001) and a draft→sent→paid lifecycle.", powers: null, keys: ["client_id"], joins: ["clients"] },
      { name: "notes", sql: "sql/001", meaning: "Clinical documentation (soft-deleted, sign-and-lock lifecycle). PHI.", powers: null, keys: ["client_id"], joins: ["clients"] },
      { name: "messages", sql: "sql/001", meaning: "Individual secure messages within a thread; read_at marks recipient receipt. PHI.", powers: null, keys: ["client_id"], joins: ["clients"] },
      { name: "files", sql: "sql/001", meaning: "Client documents: portal uploads, rendered form PDFs, generated superbills. PHI.", powers: null, keys: ["client_id"], joins: ["clients"] },
      { name: "payers", sql: "sql/001", meaning: "Insurance companies for BILLING (name + clearinghouse code) — distinct from payer_sources (the directory harvest side).", powers: null, keys: ["payer_id"], joins: ["insurance_policies"] },
      { name: "insurance_policies", sql: "sql/001", meaning: "A client's coverage with a payer (member/group ids, verification status, copay). PHI.", powers: null, keys: ["client_id", "payer_id"], joins: ["clients", "payers"] },
    ],
  },
];

// Flatten the metadata into a lookup, and record each table's domain.
const META = new Map();
for (const g of GROUPS) for (const t of g.tables) META.set(t.name, { ...t, domain: g.title });

// ── introspection ────────────────────────────────────────────────────────────
async function introspect() {
  const relations = await sql`
    SELECT c.relname AS name, c.relkind AS kind, GREATEST(c.reltuples, -1)::bigint AS est
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'm')
    ORDER BY c.relname`;

  const cols = await sql`
    SELECT c.relname AS tbl, a.attname AS col, format_type(a.atttypid, a.atttypmod) AS type, a.attnum AS ord
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'm') AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum`;

  const fks = await sql`
    SELECT c.relname AS tbl, cf.relname AS ref
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_class cf ON cf.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'f' AND n.nspname = 'public'`;

  // Exact counts only for the small relations (never the big ones).
  const present = relations.filter((r) => SAFE_IDENT.test(r.name));
  const small = present.filter((r) => Number(r.est) < BIG_ROW_THRESHOLD).map((r) => r.name);
  let exact = {};
  if (small.length) {
    const q = "SELECT " + small.map((t) => `(SELECT count(*) FROM ${t}) AS "${t}"`).join(", ");
    exact = (await sql.query(q, []))[0] ?? {};
  }

  const columns = new Map();
  for (const c of cols) {
    if (!columns.has(c.tbl)) columns.set(c.tbl, []);
    columns.get(c.tbl).push({ name: c.col, type: c.type });
  }

  const fkEdges = new Map();
  for (const f of fks) {
    if (f.tbl === f.ref) continue;
    if (!fkEdges.has(f.tbl)) fkEdges.set(f.tbl, new Set());
    fkEdges.get(f.tbl).add(f.ref);
  }

  return present.map((r) => {
    const big = Number(r.est) >= BIG_ROW_THRESHOLD;
    const exactN = exact[r.name];
    return {
      name: r.name,
      kind: r.kind === "m" ? "matview" : "table",
      rows: big || exactN == null ? Number(r.est) : Number(exactN),
      rowKind: big || exactN == null ? "estimate" : "exact",
      columns: columns.get(r.name) ?? [],
      fkRefs: fkEdges.get(r.name) ?? new Set(),
    };
  });
}

// Read the nightly cron's VIEWS array — the refresh registry, not restated.
function cronViews() {
  try {
    const src = fs.readFileSync(CRON_ROUTE, "utf8");
    const block = src.slice(src.indexOf("const VIEWS"), src.indexOf("] as const", src.indexOf("const VIEWS")));
    return new Set([...block.matchAll(/"([a-z_][a-z0-9_]*)"/g)].map((m) => m[1]));
  } catch {
    return new Set();
  }
}

// ── formatting ────────────────────────────────────────────────────────────────
const commas = (n) => Number(n).toLocaleString("en-US");
function rowLabel(rel) {
  if (rel.rows < 0) return "—";
  return rel.rowKind === "estimate" ? `≈ ${commas(rel.rows)}` : commas(rel.rows);
}

// Undirected join graph, restricted to relations that actually exist, merging
// declared joins with detected FKs. Returns [{table, via}] for one table.
function joinsFor(name, liveNames) {
  const out = new Map();
  const add = (other, via) => {
    if (other === name || !liveNames.has(other)) return;
    if (!out.has(other) || (via && !out.get(other))) out.set(other, via ?? out.get(other) ?? null);
  };
  const m = META.get(name);
  const myKeys = new Set(m?.keys ?? []);
  // declared (this side)
  for (const j of m?.joins ?? []) {
    const om = META.get(j);
    const via = om ? (om.keys ?? []).find((k) => myKeys.has(k)) : null;
    add(j, via ?? null);
  }
  // declared (other side pointing here)
  for (const [other, om] of META) {
    if (other === name) continue;
    if ((om.joins ?? []).includes(name)) {
      const via = (om.keys ?? []).find((k) => myKeys.has(k));
      add(other, via ?? null);
    }
  }
  return [...out.entries()].map(([table, via]) => ({ table, via })).sort((a, b) => a.table.localeCompare(b.table));
}

function main(relations) {
  const live = new Map(relations.map((r) => [r.name, r]));
  const liveNames = new Set(live.keys());
  const views = cronViews();
  const mapped = new Set(META.keys());
  const unmapped = relations.filter((r) => !mapped.has(r.name));
  const matviews = relations.filter((r) => r.kind === "matview");
  const genDate = new Date().toISOString().slice(0, 10);

  // ── DATABASE.md ──
  const L = [];
  L.push("# Liminal Database Atlas", "");
  L.push(`> **Generated** by \`scripts/db-atlas.mjs\` on ${genDate} — do not hand-edit. Re-run \`node --env-file=.env.local scripts/db-atlas.mjs\` to refresh. Row counts on tables above ${commas(BIG_ROW_THRESHOLD)} rows are planner estimates (\`≈\`), never \`count(*)\`.`, "");
  L.push(`The live public schema holds **${relations.length}** relations — ${relations.filter((r) => r.kind === "table").length} tables and ${matviews.length} materialized views. Grouped by domain below; the graph of how they join is in the per-table Obsidian notes under \`~/Vaults/hq/liminal/atlas/\`.`, "");

  // Contents
  L.push("## Contents", "");
  for (const g of GROUPS) L.push(`- [${g.title}](#${slug(g.title)})`);
  if (unmapped.length) L.push(`- [Unmapped tables](#unmapped-tables)`);
  L.push(`- [Matview lineage](#matview-lineage)`, "");

  // Domains
  for (const g of GROUPS) {
    L.push(`## ${g.title}`, "", `_${g.blurb}_`, "");
    for (const t of g.tables) {
      const rel = live.get(t.name);
      if (!rel) {
        L.push(`### \`${t.name}\` · _not yet loaded_`, "", t.meaning, `Defined in ${t.sql}; the loader hasn't populated it in this database yet.`, "");
        continue;
      }
      const isView = rel.kind === "matview";
      L.push(`### \`${t.name}\``, "");
      L.push(t.meaning, "");
      const facts = [`**${isView ? "Matview" : "Table"}**`, `${rowLabel(rel)} rows`, `defined in ${t.sql}`];
      if (t.powers) facts.push(`powers \`${t.powers}\``);
      if (isView) facts.push(views.has(t.name) ? "refreshed nightly by the 04:12 cron" : "refreshed on ingest (not in the nightly cron)");
      L.push(facts.join(" · "), "");
      const js = joinsFor(t.name, liveNames);
      if (js.length) L.push(`**Joins:** ${js.map((j) => `\`${j.table}\`${j.via ? ` (\`${j.via}\`)` : ""}`).join(" · ")}`, "");
      L.push(columnTable(rel.columns), "");
    }
  }

  // Unmapped
  if (unmapped.length) {
    L.push(`## Unmapped tables`, "", "_In the database but not yet in the atlas metadata (mirror `lib/repos/admin.ts`). Structure + count only._", "");
    for (const rel of unmapped) {
      L.push(`### \`${rel.name}\``, "", `**${rel.kind === "matview" ? "Matview" : "Table"}** · ${rowLabel(rel)} rows · ${rel.columns.length} columns`, "");
      L.push(columnTable(rel.columns), "");
    }
  }

  // Matview lineage
  L.push(`## Matview lineage`, "", "The derived views the app reads instead of the base tables. The nightly 04:12 cron (`app/api/cron/daily/route.ts`) rebuilds the ones marked ✓, `CONCURRENTLY`, in dependency order.", "");
  L.push("| Matview | Defined in | Rebuilt by nightly cron | Reads |", "| --- | --- | --- | --- |");
  for (const rel of matviews) {
    const m = META.get(rel.name);
    const reads = m ? joinsFor(rel.name, liveNames).map((j) => `\`${j.table}\``).slice(0, 4).join(", ") : "—";
    L.push(`| \`${rel.name}\` | ${m?.sql ?? "—"} | ${views.has(rel.name) ? "✓" : "on ingest"} | ${reads || "—"} |`);
  }
  L.push("");
  const notRefreshed = matviews.filter((r) => !views.has(r.name) && META.has(r.name));
  if (notRefreshed.length) {
    L.push(`> Matviews **not** in the nightly cron (${notRefreshed.map((r) => `\`${r.name}\``).join(", ")}) are rebuilt as part of a script's post-ingest routine — see \`docs/ops/SCRIPTS.md\`.`, "");
  }

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, L.join("\n"));

  // ── Obsidian notes ──
  fs.mkdirSync(VAULT_DIR, { recursive: true });
  let noteCount = 0;
  for (const rel of relations) {
    const m = META.get(rel.name);
    const isView = rel.kind === "matview";
    const N = [];
    N.push("---");
    N.push(`table: ${rel.name}`);
    N.push(`domain: ${m?.domain ?? "Unmapped"}`);
    N.push(`kind: ${isView ? "matview" : "table"}`);
    N.push(`rows: ${rowLabel(rel).replace(/^≈ /, "~")}`);
    if (m?.sql) N.push(`sql: ${m.sql}`);
    if (m?.powers) N.push(`powers: ${m.powers}`);
    N.push(`tags: [liminal-atlas]`);
    N.push(`generated: ${genDate}`);
    N.push("---", "");
    N.push(`# ${rel.name}`, "");
    if (m) N.push(m.meaning, "");
    const facts = [`**Kind:** ${isView ? "matview" : "table"}`, `**Rows:** ${rowLabel(rel)}`];
    if (m?.sql) facts.push(`**Defined in:** ${m.sql}`);
    if (m?.powers) facts.push(`**Powers:** ${m.powers}`);
    if (isView) facts.push(`**Refresh:** ${views.has(rel.name) ? "nightly 04:12 cron" : "on ingest"}`);
    N.push(facts.join(" · "), "");
    const js = joinsFor(rel.name, liveNames);
    if (js.length) {
      N.push("## Joins", "");
      for (const j of js) N.push(`- [[${j.table}]]${j.via ? ` — via \`${j.via}\`` : ""}`);
      N.push("");
    }
    N.push("## Columns", "", columnTable(rel.columns), "");
    fs.writeFileSync(path.join(VAULT_DIR, `${rel.name}.md`), N.join("\n"));
    noteCount++;
  }

  // Index note for the graph
  const idx = ["---", "tags: [liminal-atlas]", `generated: ${genDate}`, "---", "", "# Liminal Atlas", "", `${relations.length} relations, generated ${genDate} by \`scripts/db-atlas.mjs\`. Full reference: \`docs/data/DATABASE.md\` in the repo.`, ""];
  for (const g of GROUPS) {
    idx.push(`## ${g.title}`, "");
    for (const t of g.tables) if (liveNames.has(t.name)) idx.push(`- [[${t.name}]]`);
    idx.push("");
  }
  if (unmapped.length) {
    idx.push("## Unmapped", "");
    for (const rel of unmapped) idx.push(`- [[${rel.name}]]`);
    idx.push("");
  }
  fs.writeFileSync(path.join(VAULT_DIR, "_atlas.md"), idx.join("\n"));

  return { relations: relations.length, tables: relations.length - matviews.length, matviews: matviews.length, unmapped: unmapped.length, notes: noteCount + 1 };
}

function columnTable(cols) {
  if (!cols.length) return "_no columns_";
  return ["| column | type |", "| --- | --- |", ...cols.map((c) => `| \`${c.name}\` | ${c.type} |`)].join("\n");
}
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ── run ───────────────────────────────────────────────────────────────────────
const relations = await introspect();
const stats = main(relations);
console.log(`db-atlas: ${stats.relations} relations (${stats.tables} tables, ${stats.matviews} matviews), ${stats.unmapped} unmapped.`);
console.log(`  → ${path.relative(ROOT, OUT_MD)}`);
console.log(`  → ${stats.notes} Obsidian notes in ${VAULT_DIR}`);

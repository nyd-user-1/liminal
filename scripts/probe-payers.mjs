#!/usr/bin/env node
// Probe payer FHIR endpoints for harvestability (Task 2A Step 2). READ-ONLY:
// makes at most 2 GETs per target, writes NO directory data. Records a capability
// row per target into payer_sources (last_probe_result) and prints the verdict
// table. Enforces the four rules as hard guards — refuses to touch any sandbox,
// Patient Access, or clearinghouse URL even if mis-listed.
//
//   node --env-file=.env.local scripts/probe-payers.mjs
//
// Verdicts: harvest_now | needs_registration | blocked | unusable | out_of_scope

import { neon } from "@neondatabase/serverless";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const NUCC = "http://nucc.org/provider-taxonomy";
const PROBE_CODE = "2084P0800X"; // Psychiatry — a BH code most directories carry

// ── HARD GUARDS — never probe these, whatever a target list says ─────────────
// Sandboxes (synthetic data), Patient Access (member PHI), clearinghouses (EDI).
const FORBIDDEN = [
  /devportal|sandbox|sbx|\bvte\b|vteapif1|staging/i,       // sandboxes
  /apif1\.aetna\.com\/fhir\/v1\/?$/i,                        // Aetna Patient Access (bare path)
  /patient360\.anthem\.com|apirt\.hyphencare\.com/i,         // Patient Access
  /optum\.com|availity|changehealthcare|waystar|claim\.md/i, // clearinghouses / EDI
];
function assertAllowed(url) {
  for (const re of FORBIDDEN) if (re.test(url)) throw new Error(`GUARD: refusing forbidden URL (${re}) — ${url}`);
}

// ── targets ──────────────────────────────────────────────────────────────────
// class: 'fhir' = probe the live endpoint; 'portal' = developer portal (registration
// only, not an open FHIR base) → needs_registration without a data probe; 'live' =
// already harvesting (Humana) → do NOT add probe traffic (WAF-sensitive, running).
const TARGETS = [
  { slug: "cigna", name: "Cigna", base: "https://fhir.cigna.com/ProviderDirectory/v1/", cls: "fhir", igHint: "1.0.0", note: "docs: no auth" },
  { slug: "healthfirst", name: "Healthfirst", base: "https://hf-fhir-provider-directory-sys-api-prod.us-e1.cloudhub.io/", cls: "fhir", note: "docs: public directory" },
  { slug: "humana", name: "Humana", base: "https://fhir.humana.com/api/", cls: "live", note: "already harvesting — not re-probed (WAF)" },
  { slug: "aetna_medicaid", name: "Aetna (Medicaid)", base: "https://apif1.aetna.com/fhir/v1/providerdirectory/", cls: "fhir", igHint: "1.1.0", note: "token expected" },
  { slug: "aetna_commercial", name: "Aetna (Commercial+Medicare)", base: "https://apif1.aetna.com/fhir/v1/providerdirectorydata/", cls: "fhir", igHint: "1.2.0", exportHint: true, note: "token expected; has $export" },
  { slug: "elevance", name: "Elevance HealthOS (Empire/Carelon)", base: "https://totalview.healthos.elevancehealth.com/fhir/", cls: "fhir", note: "Empire BCBS + Carelon BH" },
  { slug: "carefirst", name: "CareFirst", base: "https://developer.carefirst.com/product/fhir-provider-directory", cls: "portal", note: "developer portal — registration" },
  { slug: "molina", name: "Molina", base: "https://developer.interop.molinahealthcare.com", cls: "portal", note: "developer portal — registration" },
  { slug: "lacare", name: "LA Care", base: "https://oauthq.lacare.org/fhir/us/davinci-pdex-plan-net-v1/api/", cls: "fhir", note: "oauth-gated host" },
];

const HEADERS = { Accept: "application/fhir+json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, timeoutMs = 20000) {
  assertAllowed(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    const txt = await r.text();
    let json = null;
    try { json = JSON.parse(txt); } catch { /* non-JSON (HTML error / WAF) */ }
    return { status: r.status, json, textHead: txt.slice(0, 160) };
  } catch (err) {
    return { status: 0, json: null, err: err.message };
  } finally { clearTimeout(t); }
}

// ── FHIR helpers (URL-suffix matching, never index) ──────────────────────────
function deepFindExt(node, suffix, depth = 0) {
  if (!node || depth > 6) return null;
  const exts = Array.isArray(node.extension) ? node.extension : [];
  for (const e of exts) {
    if (typeof e?.url === "string" && e.url.endsWith(suffix)) return e;
    const nested = deepFindExt(e, suffix, depth + 1);
    if (nested) return nested;
  }
  return null;
}
function hasNpi(resource) {
  for (const id of resource?.identifier || []) {
    const sys = String(id.system || "").toLowerCase();
    if ((sys.includes("us-npi") || sys.includes("/npi")) && /^\d{10}$/.test(String(id.value || ""))) return id.value;
  }
  return null;
}

async function probeFhir(t) {
  const base = t.base.endsWith("/") ? t.base : t.base + "/";
  const r = {
    slug: t.slug, name: t.name, base,
    http: null, auth_required: null, directory: null, accepting: null,
    npi: null, include: null, lastupdated: null, export: !!t.exportHint,
    paginates: null, cardinality: "unknown", ig: t.igHint || null, verdict: "unusable", note: t.note || "",
  };

  // (A) metadata — auth wall + capabilities
  const meta = await get(base + "metadata");
  r.http = meta.status;
  if (meta.status === 401 || meta.status === 403) {
    r.auth_required = true; r.verdict = "needs_registration";
    return r;
  }
  if (meta.status === 0) { r.verdict = "blocked"; r.note += ` (${meta.err || "network"})`; return r; }
  if (meta.json?.resourceType === "CapabilityStatement") {
    r.ig = r.ig || (meta.json.fhirVersion ? `FHIR ${meta.json.fhirVersion}` : null);
    const rest = meta.json.rest?.[0];
    const prRes = rest?.resource?.find((x) => x.type === "PractitionerRole");
    if (prRes) {
      r.include = (prRes.searchInclude || []).some((s) => /practitioner|location|network/i.test(s)) || null;
      r.lastupdated = (prRes.searchParam || []).some((s) => s.name === "_lastUpdated") || null;
    }
    const ops = [...(rest?.operation || []), ...(prRes?.operation || [])];
    if (ops.some((o) => /\$?export/i.test(o.name || o.definition || ""))) r.export = true;
  }

  // (B) functional probe — one specialty slice with all includes
  const q = base + `PractitionerRole?specialty=${encodeURIComponent(NUCC + "|" + PROBE_CODE)}` +
    `&_include=PractitionerRole:practitioner&_include=PractitionerRole:location` +
    `&_include=PractitionerRole:network&_include=PractitionerRole:organization&_count=3`;
  const b = await get(q);
  if (r.http === null || (meta.status !== 200 && b.status)) r.http = b.status;
  if (b.status === 401 || b.status === 403) { r.auth_required = true; r.verdict = "needs_registration"; return r; }
  if (b.status !== 200 || b.json?.resourceType !== "Bundle") {
    r.verdict = meta.status === 200 ? "needs_registration" : "unusable";
    r.note += ` (PractitionerRole ${b.status})`;
    return r;
  }
  r.auth_required = r.auth_required ?? false;
  const entries = b.json.entry || [];
  const roles = entries.map((e) => e.resource).filter((x) => x?.resourceType === "PractitionerRole");
  const pracs = entries.map((e) => e.resource).filter((x) => x?.resourceType === "Practitioner");
  const nets = entries.map((e) => e.resource).filter((x) => x?.resourceType === "Organization" && /network/i.test(x?.name || "") || x?.resourceType === "Network");
  r.include = r.include ?? (pracs.length > 0 || entries.some((e) => e.search?.mode === "include"));
  r.paginates = (b.json.link || []).some((l) => l.relation === "next");
  const role0 = roles[0];
  if (role0) {
    r.directory = !!deepFindExt(role0, "network-reference") || nets.length > 0;
    r.accepting = !!deepFindExt(role0, "newpatients");
    const locN = (role0.location || []).length;
    const netN = (role0.extension || []).filter((e) => String(e.url).endsWith("network-reference")).length;
    r.cardinality = `${locN <= 1 ? "one" : "many"}_loc_${netN <= 1 ? "one" : "many"}_net`;
    r.lastupdated = r.lastupdated ?? !!role0.meta?.lastUpdated;
    const prof = role0.meta?.profile?.find((p) => /plan-net/i.test(p));
    if (prof && !r.ig) r.ig = prof;
  }
  // NPI: from an included Practitioner
  r.npi = pracs.some((p) => hasNpi(p)) ? true : (pracs.length ? false : null);
  r.directory = r.directory ?? false;

  // verdict
  if (r.directory && r.npi !== false) r.verdict = "harvest_now";
  else if (r.directory && r.npi === false) r.verdict = "unusable"; // directory but no NPI → can't join
  else r.verdict = "needs_registration";
  return r;
}

async function run() {
  const results = [];
  for (const t of TARGETS) {
    process.stdout.write(`probing ${t.name}… `);
    if (t.cls === "live") {
      results.push({ slug: t.slug, name: t.name, base: t.base, http: "—", auth_required: false, directory: true, accepting: true, npi: true, include: false, lastupdated: true, export: false, paginates: true, cardinality: "many_loc_many_net", ig: "Plan-Net", verdict: "harvest_now", note: t.note });
      console.log("(already live)");
      continue;
    }
    if (t.cls === "portal") {
      results.push({ slug: t.slug, name: t.name, base: t.base, http: "—", auth_required: true, directory: null, accepting: null, npi: null, include: null, lastupdated: null, export: false, paginates: null, cardinality: "—", ig: null, verdict: "needs_registration", note: t.note });
      console.log("(developer portal → registration)");
      continue;
    }
    try {
      const r = await probeFhir(t);
      results.push(r);
      console.log(`${r.http} → ${r.verdict}`);
    } catch (err) {
      results.push({ slug: t.slug, name: t.name, base: t.base, http: "ERR", verdict: "blocked", note: err.message });
      console.log(`ERROR: ${err.message}`);
    }
    await sleep(400); // polite between targets
  }

  // ── table ──
  const yn = (v) => (v === true ? "yes" : v === false ? "no" : v == null ? "?" : String(v));
  console.log("\n=== Step 2 — probe report ===\n");
  const head = ["payer", "http", "auth?", "dir?", "accept?", "npi?", "$export?", "_include?", "pages?", "cardinality", "ig", "verdict"];
  const rows = results.map((r) => [
    r.name.slice(0, 26), yn(r.http), yn(r.auth_required), yn(r.directory), yn(r.accepting),
    yn(r.npi), yn(r.export), yn(r.include), yn(r.paginates), r.cardinality || "?", (r.ig || "?").slice(0, 14), r.verdict,
  ]);
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((row) => String(row[i]).length)));
  const fmt = (row) => row.map((c, i) => String(c).padEnd(w[i])).join("  ");
  console.log(fmt(head));
  console.log(w.map((n) => "─".repeat(n)).join("  "));
  for (const row of rows) console.log(fmt(row));

  // ── record capability rows (light: one upsert per target, sequential) ──
  if (sql) {
    for (const r of results) {
      const authStrategy = r.auth_required ? "oauth2_client_credentials" : r.auth_required === false ? "none" : "unknown";
      const pagination = r.export ? "bulk_export" : r.paginates ? "bundle_next_link" : r.verdict === "harvest_now" ? "narrow_query_slices" : "unknown";
      try {
        await sql`
          INSERT INTO payer_sources (slug, name, fhir_base_url, auth_type, auth_strategy, pagination_strategy,
            supports_include, supports_lastupdated, ig_version, role_cardinality, status, active,
            last_probe_at, last_probe_result, bulk_export_url)
          VALUES (${r.slug}, ${r.name}, ${r.base}, ${r.auth_required ? "oauth2" : "none"}, ${authStrategy}, ${pagination},
            ${r.include ?? null}, ${r.lastupdated ?? null}, ${r.ig ?? null}, ${r.cardinality ?? null},
            ${r.verdict}, ${r.verdict === "harvest_now"}, now(), ${JSON.stringify(r)}, ${r.export ? r.base + "$export" : null})
          ON CONFLICT (slug) DO UPDATE SET
            auth_strategy = EXCLUDED.auth_strategy, pagination_strategy = EXCLUDED.pagination_strategy,
            supports_include = EXCLUDED.supports_include, supports_lastupdated = EXCLUDED.supports_lastupdated,
            ig_version = COALESCE(EXCLUDED.ig_version, payer_sources.ig_version),
            role_cardinality = EXCLUDED.role_cardinality,
            status = CASE WHEN payer_sources.slug = 'humana' THEN payer_sources.status ELSE EXCLUDED.status END,
            last_probe_at = now(), last_probe_result = EXCLUDED.last_probe_result,
            bulk_export_url = COALESCE(EXCLUDED.bulk_export_url, payer_sources.bulk_export_url),
            updated_at = now()`;
      } catch (err) {
        console.error(`\n⚠ DB write failed for ${r.slug} — HALTING (kill switch): ${err.message}`);
        process.exit(1);
      }
    }
    console.log("\n(capability rows recorded to payer_sources)");
  }

  console.log("\nGuardrails honored: no sandbox/Patient-Access/clearinghouse URL was contacted (hard-guarded).");
}

run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });

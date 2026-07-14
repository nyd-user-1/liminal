#!/usr/bin/env node
// Ingest payer insurance-network data (FHIR Da Vinci PDex Plan-Net) into Neon,
// enriching our existing NPPES providers with plan participation + accepting-new-
// patients status. Config-driven over payers: Humana is the reference source;
// Aetna/UHC/Cigna become new PAYER_REGISTRY entries (+ an auth strategy if
// auth_type <> 'none'), not new code paths.
//
//   node --env-file=.env.local scripts/ingest-payers.mjs --payer=humana                 (enrich)
//   node --env-file=.env.local scripts/ingest-payers.mjs --payer=humana --limit=800     (proof)
//   node --env-file=.env.local scripts/ingest-payers.mjs --payer=humana --mode=walk     (discovery)
//   node --env-file=.env.local scripts/ingest-payers.mjs --payer=humana --report-only
//
// Two drivers, one extraction/upsert core:
//   --mode=enrich  (default) — the efficient enrichment path. Iterate the NPIs we
//     already have (directory_providers is already NY + behavioral-health) and ask
//     the payer about each: Practitioner?identifier=<npi> → PractitionerRole?
//     practitioner=<id>. Every hit is matched by construction; MATCH-only, no
//     invented providers. This is what produces the Step-3 proof.
//   --mode=walk — the general discovery path the payer publishes: walk
//     PractitionerRole by our behavioral-health NUCC set via Bundle link.next,
//     filter to --state (default NY) client-side via included Locations, match on
//     npi, and PARK unmatched NPIs in payer_unmatched_npis. Heavy for a payer with
//     a small NY footprint (Humana): use --limit for a bounded demo.
//
// Flags: --payer=<slug> --mode=enrich|walk --state=NY --count=<n> --limit=<n>
//        --specialty=<code> --max-pages=<n> --resume --checkpoint=<p> --dry-run
//        --report-only --delay=<ms> --concurrency=<n> (enrich; parallel NPI probes)

import { neon } from "@neondatabase/serverless";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { MH_TAXONOMY, taxLabel, isMentalHealthTaxonomy } from "./lib/mh-taxonomy.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set. Run with: node --env-file=.env.local scripts/ingest-payers.mjs");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

// ── args ─────────────────────────────────────────────────────────────────────
function arg(name, dflt = null) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return dflt;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
}
const PAYER = String(arg("payer", "humana"));
const MODE = String(arg("mode", "enrich"));
const STATE = arg("state", "NY") === false ? null : String(arg("state", "NY"));
const PAGE_COUNT = Number(arg("count", 50));
const LIMIT = arg("limit") ? Number(arg("limit")) : Infinity;
const ONE_SPECIALTY = arg("specialty") ? String(arg("specialty")) : null;
const MAX_PAGES = Number(arg("max-pages", 10000));
const DELAY = Number(arg("delay", 120));
const CONCURRENCY = Math.max(1, Number(arg("concurrency", 1)));
const WAIT_UNBLOCK = !!arg("wait-for-unblock", false); // poll until the WAF lifts before starting
const COOLDOWN_MS = Number(arg("cooldown", 300000));    // pause length when the circuit breaker trips
const RESUME = !!arg("resume", false);
const DRY_RUN = !!arg("dry-run", false);
const REPORT_ONLY = !!arg("report-only", false);
const CHECKPOINT = String(arg("checkpoint", path.join(os.tmpdir(), `liminal-ingest-${PAYER}-${MODE}.json`)));

const NUCC_SYSTEM = "http://nucc.org/provider-taxonomy";
const NPI_SYSTEM = "http://hl7.org/fhir/sid/us-npi";

// ── payer registry (config-driven; the "PayerSource interface") ──────────────
// Each entry is a source config. authType 'none' → no headers. To add a payer
// needing auth, add an entry with authType 'apikey'|'oauth2' and a buildHeaders()
// — no other code changes. HumanaSource is the reference implementation.
const FHIR_HEADERS = async () => ({ Accept: "application/fhir+json" });
// Anthem (NYS-15, approved 2026-07-13): client-credentials OAuth, token TTL 3600s.
// Harvest runs outlive the token, so refresh on an interval and mutate the shared
// headers object in place — every driver holds `headers` by reference, so no
// other code changes. A request racing expiry 401s once and lands in the normal
// failed-NPI retry pass.
const ANTHEM_TOKEN_URL = "https://totalview.healthos.elevancehealth.com/client.oauth2/unregistered/api/v1/token";
async function anthemHeaders() {
  if (!process.env.ANTHEM_CLIENT_ID || !process.env.ANTHEM_CLIENT_SECRET) {
    console.error("ANTHEM_CLIENT_ID / ANTHEM_CLIENT_SECRET not set — run with node --env-file=.env.local");
    process.exit(1);
  }
  const h = { Accept: "application/fhir+json" };
  const refresh = async () => {
    const r = await fetch(ANTHEM_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.ANTHEM_CLIENT_ID,
        client_secret: process.env.ANTHEM_CLIENT_SECRET,
      }),
    });
    const j = await r.json().catch(() => null);
    if (!j?.access_token) throw new Error(`Anthem token: HTTP ${r.status}`);
    h.Authorization = `Bearer ${j.access_token}`;
  };
  await refresh();
  setInterval(() => refresh().catch((e) => console.error(`\n  ⚠ Anthem token refresh failed: ${e.message}`)), 45 * 60 * 1000).unref();
  return h;
}
const PAYER_REGISTRY = {
  humana: {
    slug: "humana", name: "Humana", fhirBaseUrl: "https://fhir.humana.com/api/",
    authType: "none", planNetProfile: true, buildHeaders: FHIR_HEADERS,
    // Humana: chained params are WAF-blocked but plain reference params are not,
    // and location= accepts comma OR-lists (≥100 ids per request measured OK).
    // Roles carry location refs → NY-boundable via --mode=locbatch (Path B):
    // enumerate Location?address-state=NY, then walk PractitionerRole?location=
    // <batch> per link.next. Full Plan-Net (network name in display + newpatients).
    defaultMode: "locbatch", completeness: "full",
  },
  cigna: {
    slug: "cigna", name: "Cigna", fhirBaseUrl: "https://fhir.cigna.com/ProviderDirectory/v1/",
    authType: "none", planNetProfile: true, buildHeaders: FHIR_HEADERS,
    // Cigna: anonymous + supports PractitionerRole?practitioner.identifier=<npi>,
    // so reverse-lookup our NPIs (one query each, matched-by-construction, no
    // national crawl). _include resolves the network name from the Organization
    // (Cigna's network-reference has no display, unlike Humana). Full Plan-Net.
    defaultMode: "reverse", completeness: "full",
    // Only the :network include (we already know the NPI; location is stored as a
    // ref). Cigna 400s when practitioner+location+network includes are combined,
    // and hard-400s a raw `|` in the query (WHATWG fetch leaves | unencoded) —
    // the system|value separator must be sent as %7C.
    roleQuery: (npi) => `PractitionerRole?practitioner.identifier=${encodeURIComponent(`${NPI_SYSTEM}|${npi}`)}` +
      "&_include=PractitionerRole:network&_count=50",
  },
  healthfirst: {
    slug: "healthfirst", name: "Healthfirst",
    fhirBaseUrl: "https://hf-fhir-provider-directory-sys-api-prod.us-e1.cloudhub.io/",
    authType: "none", planNetProfile: false, buildHeaders: FHIR_HEADERS,
    // Healthfirst: bare PractitionerRole (NO network, NO newpatients) and a 100-cap
    // with no paging — BUT practitioner.id IS the NPI, so point-query our NPIs
    // (?practitioner.id=<npi>). No enumeration → no cap, no truncation. COARSE.
    defaultMode: "reverse", completeness: "coarse",
    roleQuery: (npi) => `PractitionerRole?practitioner.id=${npi}`,
  },
  uhc: {
    slug: "uhc", name: "UnitedHealthcare", fhirBaseUrl: "https://flex.optum.com/fhirpublic/R4/",
    authType: "none", planNetProfile: true, buildHeaders: FHIR_HEADERS,
    // UHC public provider directory (probed 2026-07-11): production, anonymous —
    // CMS requires directory endpoints be open; registration is only for Patient
    // Access. Practitioner carries a real us-npi identifier. Chained
    // practitioner.identifier returns 0 (silently unsupported) → two-step enrich
    // (Practitioner?identifier → PractitionerRole?practitioner=<id>). Roles carry
    // newpatients + network-reference WITHOUT display → resolve the network
    // Organization via _include (roleByPractitioner below). Full Plan-Net.
    // Sandbox = flex.optum.com/fhir/sandbox/ (NEVER harvest); /fhirpublic2025
    // returned 502 on probe day. DO NOT start a UHC run while Cigna is running.
    defaultMode: "enrich", completeness: "full",
    roleByPractitioner: (id, count) =>
      `PractitionerRole?practitioner=Practitioner/${encodeURIComponent(id)}` +
      `&_include=${encodeURIComponent("PractitionerRole:network")}&_count=${count}`,
  },
  mvp: {
    slug: "mvp", name: "MVP Health Care", fhirBaseUrl: "https://api.mvphealthcare.com/provdirfhirapi/",
    authType: "none", planNetProfile: true, buildHeaders: FHIR_HEADERS,
    // Probed 2026-07-11: public production (their own docs point here; the
    // ClientID flow is Patient-Access-only). us-npi identifiers present; chained
    // practitioner.identifier works → single-request reverse-lookup; roles carry
    // network-reference + newpatients + NUCC specialty. _include never populates
    // → preload the 17 ntwk Organizations once and resolve names from that cache.
    // specialty= search times out (>15s) → no walk. Random-sample hit rate 18.3%.
    // Carelon-carve-out plan that DOES publish BH under commercial EPO/PPO (the
    // control datapoint — see PAYER-RESEARCH.md central finding). Queue behind UHC.
    defaultMode: "reverse", completeness: "full",
    roleQuery: (npi) => `PractitionerRole?practitioner.identifier=${encodeURIComponent(`${NPI_SYSTEM}|${npi}`)}&_count=50`,
    preloadNetworkIncludes: true,
  },
  anthem: {
    slug: "anthem", name: "Anthem (Empire BCBS)",
    fhirBaseUrl: "https://totalview.healthos.elevancehealth.com/resources/unregistered/api/v1/fhir/cms_mandate/mcd/",
    authType: "oauth2", planNetProfile: true, buildHeaders: anthemHeaders,
    // Probed 2026-07-13 (scripts/probe-anthem.mjs + role mini-probe): FHIR 4.0.1
    // hos-fhir-server. Chained practitioner.identifier WORKS (undeclared in the
    // CapabilityStatement but filters correctly) → single-request reverse lookup.
    // Roles carry network-reference WITH display, newpatients, NUCC specialty,
    // locations, meta.lastUpdated — full Plan-Net. _include=network kept as the
    // fallback for any display-less refs (server handles it; ntwk Organizations
    // resolve). Elevance owns Carelon (Empire Plan/NYSHIP, MetroPlus, MVP BH
    // carve-out) — watch the network names for Carelon leakage.
    defaultMode: "reverse", completeness: "full",
    // _count=200 honored (probed): heavy providers carry 125–200+ national-book
    // roles, so big pages cut per-hit round-trips ~4×. NO _include: sampled 716
    // network refs across heavy hits — 100% carry the name on
    // valueReference.display, so the include only bloated hit pages (2026-07-13).
    roleQuery: (npi) => `PractitionerRole?practitioner.identifier=${encodeURIComponent(`${NPI_SYSTEM}|${npi}`)}&_count=200`,
  },
  // aetna: gated (token) — see docs/payer-registration-checklist.md + TASK-AETNA.md
};

const source = PAYER_REGISTRY[PAYER];
if (!source) {
  console.error(`Unknown payer '${PAYER}'. Known: ${Object.keys(PAYER_REGISTRY).join(", ")}`);
  process.exit(1);
}

// ── HTTP: timeout + polite retry/backoff on 429, 5xx, and WAF/non-JSON ────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(base, refOrUrl, headers, { tries = 6, timeoutMs = 20000 } = {}) {
  const url = /^https?:\/\//.test(refOrUrl) ? refOrUrl : base.replace(/\/$/, "/") + refOrUrl.replace(/^\//, "");
  for (let attempt = 1; ; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let res, txt;
    try {
      res = await fetch(url, { headers, signal: ctrl.signal });
      txt = await res.text();
    } catch (err) {
      clearTimeout(t);
      if (attempt >= tries) throw new Error(`network/timeout after ${tries} tries: ${err.message}`);
      await sleep(Math.min(30000, 500 * 2 ** attempt));
      continue;
    }
    clearTimeout(t);
    if (res.ok) {
      try { return JSON.parse(txt); }
      catch {
        // 200 but not JSON → transient WAF/challenge page; back off and retry.
        if (attempt >= tries) throw new Error(`${url} → non-JSON body after ${tries} tries`);
        await sleep(Math.min(30000, 700 * 2 ** attempt));
        continue;
      }
    }
    // 429/5xx, Akamai/WAF 403 rate-limit pages, and transient 400s (Cigna hiccups
    // under load — the same query succeeds on retry) are all transient → back off.
    const wafBlock = res.status === 403 && /don't have permission|reference #|akamai|access denied/i.test(txt);
    if (res.status === 429 || res.status >= 500 || res.status === 400 || wafBlock) {
      if (attempt >= tries) throw new Error(`${url} → HTTP ${res.status} after ${tries} tries`);
      const ra = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(30000, 800 * 2 ** attempt);
      await sleep(wait);
      continue;
    }
    throw new Error(`${url} → HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
}

/** One raw request (no retries) → HTTP status, or 0 on network error. */
async function rawStatus(base, ref, headers, timeoutMs = 15000) {
  const url = base.replace(/\/$/, "/") + ref.replace(/^\//, "");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { const r = await fetch(url, { headers, signal: ctrl.signal }); await r.text(); return r.status; }
  catch { return 0; }
  finally { clearTimeout(t); }
}

/** Block until the payer stops returning WAF 403s (Akamai IP cooldown), or give
 *  up after ~2h. A single lightweight probe every 60s — cheap and polite. */
async function preflightUnblock(headers) {
  const probe = `Practitioner?identifier=${NPI_SYSTEM}|1295708519`; // a known in-Humana NPI
  for (let i = 0; i < 120; i++) {
    const st = await rawStatus(source.fhirBaseUrl, probe, headers);
    if (st && st !== 403) { if (i) console.log(`  WAF cleared after ${i} min — starting`); return; }
    if (i === 0) console.log("  WAF block detected — waiting for it to clear (polling 60s)…");
    await sleep(60000);
  }
  console.log("  ⚠ still blocked after ~2h — starting anyway (circuit breaker will pace it)");
}

// ── FHIR extraction helpers ──────────────────────────────────────────────────
function extBySuffix(extensions, suffix) {
  if (!Array.isArray(extensions)) return [];
  return extensions.filter((e) => typeof e?.url === "string" && e.url.endsWith(suffix));
}
/** Look up a referenced resource in a page-includes map (abs + relative ref). */
function fromIncludes(ref, includes) {
  if (!ref || !includes) return null;
  return includes.get(ref) || includes.get(ref.replace(/^https?:\/\/[^/]+\/(api\/)?/, "")) || null;
}
/** All network-reference extensions → [{ name, rawId }]. Network NAME comes from
 *  valueReference.display (Humana) or, when absent, the _include'd resource the
 *  reference points at (Cigna puts the name on the Organization). */
function networksOf(pr, includes) {
  return extBySuffix(pr.extension, "network-reference")
    .map((e) => {
      const ref = e.valueReference?.reference || null;
      const name = e.valueReference?.display || fromIncludes(ref, includes)?.name || null;
      return { name, rawId: ref };
    })
    .filter((n) => n.name);
}
/** Drop FHIR narrative (text.div — large, HTML, useless to us) before storing. */
function stripNarrative(resource) {
  if (!resource || typeof resource !== "object") return resource;
  const { text, ...rest } = resource;
  return rest;
}
/** newpatients/acceptingPatients → 'accepting' | 'not_accepting' | 'unknown'. */
function acceptingOf(pr) {
  // newpatients is usually top-level, but some IGs nest it under a fromNetwork
  // sub-extension — search one level deep as a fallback.
  let np = extBySuffix(pr.extension, "newpatients")[0];
  if (!np) {
    for (const e of pr.extension || []) { np = extBySuffix(e.extension, "newpatients")[0]; if (np) break; }
  }
  if (!np) return "unknown";
  const inner = Array.isArray(np.extension)
    ? np.extension.find((e) => String(e.url).toLowerCase().endsWith("acceptingpatients"))
    : null;
  const cc = inner?.valueCodeableConcept || np.valueCodeableConcept;
  const coding = cc?.coding?.[0];
  const code = String(coding?.code || "").toLowerCase();
  const display = String(coding?.display || "").toLowerCase();
  if (["newpt", "newptperiod", "accept", "accepting", "yes"].includes(code)) return "accepting";
  if (["nopt", "nonewpt", "notaccepting", "existptonly", "no"].includes(code)) return "not_accepting";
  if (/^accept/.test(display) && !/not/.test(display)) return "accepting";
  if (/not\s*accept|existing/.test(display)) return "not_accepting";
  return "unknown";
}
/** NUCC specialty codes on a PractitionerRole. */
function specialtyCodes(pr) {
  const out = [];
  for (const s of pr.specialty || []) for (const c of s.coding || []) {
    if (c.system === NUCC_SYSTEM && c.code) out.push(c.code);
  }
  return out;
}
/** NPI (+ display name) from a resolved Practitioner resource. */
function npiOf(resource) {
  if (!resource) return { npi: null, name: null };
  let npi = null;
  for (const id of resource.identifier || []) {
    const sys = String(id.system || "").toLowerCase();
    if ((sys.includes("us-npi") || sys.includes("/npi")) && /^\d{10}$/.test(String(id.value || ""))) { npi = id.value; break; }
  }
  const n = resource.name?.[0];
  const name = n ? [n.prefix?.join(" "), n.given?.join(" "), n.family, n.suffix?.join(" ")].filter(Boolean).join(" ").trim() : null;
  return { npi, name: name || resource.name?.[0]?.text || null };
}
/** State(s) referenced by a PractitionerRole via its included Locations. */
function statesOf(pr, includes) {
  const states = new Set();
  for (const l of pr.location || []) {
    const ref = l.reference;
    const loc = ref ? (includes.get(ref) || includes.get(ref.replace(/^https?:\/\/[^/]+\/(api\/)?/, ""))) : null;
    if (loc?.address?.state) states.add(loc.address.state);
  }
  return states;
}

// ── DB helpers ───────────────────────────────────────────────────────────────
async function ensurePayerSource() {
  const rows = await sql`
    INSERT INTO payer_sources (slug, name, fhir_base_url, auth_type, plan_net_profile)
    VALUES (${source.slug}, ${source.name}, ${source.fhirBaseUrl}, ${source.authType}, ${source.planNetProfile})
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name, fhir_base_url = EXCLUDED.fhir_base_url,
      auth_type = EXCLUDED.auth_type, plan_net_profile = EXCLUDED.plan_net_profile, updated_at = now()
    RETURNING id`;
  return rows[0].id;
}
async function loadKnownNpis() {
  const rows = await sql`SELECT DISTINCT npi FROM directory_providers WHERE npi IS NOT NULL`;
  return new Set(rows.map((r) => r.npi));
}
// order='npi' (ascending, stable) or 'random' (md5(npi) — stable pseudo-random so
// resume still works, but hits/misses distribute evenly instead of clumping in the
// oldest-NPI range). Reverse-lookup uses 'random' so early progress is representative.
async function loadOurNpis(limit, order = "npi") {
  const rand = order === "random";
  const rows = limit === Infinity
    ? (rand ? await sql`SELECT npi FROM (SELECT DISTINCT npi FROM directory_providers WHERE npi IS NOT NULL) t ORDER BY md5(npi)`
            : await sql`SELECT DISTINCT npi FROM directory_providers WHERE npi IS NOT NULL ORDER BY npi`)
    : (rand ? await sql`SELECT npi FROM (SELECT DISTINCT npi FROM directory_providers WHERE npi IS NOT NULL) t ORDER BY md5(npi) LIMIT ${limit}`
            : await sql`SELECT DISTINCT npi FROM directory_providers WHERE npi IS NOT NULL ORDER BY npi LIMIT ${limit}`);
  return rows.map((r) => r.npi);
}

const networkIdCache = new Map();
async function networkId(payerSourceId, name, rawId) {
  if (networkIdCache.has(name)) return networkIdCache.get(name);
  if (DRY_RUN) { networkIdCache.set(name, `dry-${networkIdCache.size}`); return networkIdCache.get(name); }
  const rows = await sql`
    INSERT INTO payer_networks (payer_source_id, network_name, raw_network_id)
    VALUES (${payerSourceId}, ${name}, ${rawId})
    ON CONFLICT (payer_source_id, network_name) DO UPDATE SET
      raw_network_id = COALESCE(EXCLUDED.raw_network_id, payer_networks.raw_network_id), updated_at = now()
    RETURNING id`;
  networkIdCache.set(name, rows[0].id);
  return rows[0].id;
}
// Kill switch: on a DB write REJECTION we throw immediately (no tight retry loop
// against a struggling 1-CU Neon). The throw halts the whole run and reports.
// Connection-layer failures (laptop/Neon network blips — observed 3× on
// 2026-07-11 as `fetch failed`/UND_ERR_CONNECT_TIMEOUT while the DB was healthy
// seconds later) are NOT write rejections: retry once after 30s, then crash
// plainly so the babysitter restarts with --resume instead of halting for good.
const isConnError = (msg) => /fetch failed|CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|Error connecting to database/i.test(msg);
async function upsertChunked(table, cols, conflictCols, updateCols, records, conflictSuffix = "") {
  if (!records.length || DRY_RUN) return records.length;
  // Postgres rejects a single INSERT that hits the same conflict key twice
  // ("cannot affect row a second time"), so collapse duplicates by conflict key
  // (last-wins) before chunking. Cross-batch dupes are handled by ON CONFLICT.
  const byKey = new Map();
  for (const rec of records) byKey.set(conflictCols.map((c) => rec[c] ?? "").join(" "), rec);
  records = [...byKey.values()];
  const CHUNK = 500;
  for (let i = 0; i < records.length; i += CHUNK) {
    const slice = records.slice(i, i + CHUNK);
    const values = [], params = [];
    let p = 1;
    for (const rec of slice) {
      values.push(`(${cols.map(() => `$${p++}`).join(",")})`);
      for (const c of cols) params.push(rec[c] ?? null);
    }
    const set = updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
    const text = `INSERT INTO ${table} (${cols.join(",")}) VALUES ${values.join(",")} ON CONFLICT (${conflictCols.join(",")})${conflictSuffix} DO UPDATE SET ${set}`;
    try { await sql.query(text, params); }
    catch (err) {
      if (!isConnError(err.message)) throw new Error(`KILL SWITCH — ${table} write failed, halting: ${err.message}`);
      console.log(`\n  ⚠ DB connection blip on ${table} write — retrying once in 30s…`);
      await sleep(30000);
      try { await sql.query(text, params); }
      catch (err2) {
        if (!isConnError(err2.message)) throw new Error(`KILL SWITCH — ${table} write failed, halting: ${err2.message}`);
        throw new Error(`DB CONNECTION LOST — ${table} write failed twice (${err2.message}); crashing for babysitter restart`);
      }
    }
  }
  return records.length;
}

function readCheckpoint() { try { return JSON.parse(fs.readFileSync(CHECKPOINT, "utf8")); } catch { return null; } }
function writeCheckpoint(cp) { if (DRY_RUN) return; try { fs.writeFileSync(CHECKPOINT, JSON.stringify(cp)); } catch { /* best-effort */ } }

// ── participation / unmatched buffering ──────────────────────────────────────
const stats = { probed: 0, hits: 0, scanned: 0, kept: 0, matched: 0, unmatched: 0, participation: 0, pages: 0 };
const partBuf = [], unmatchedBuf = [];

async function flush() {
  const rows = partBuf.splice(0);
  const cols = ["npi", "payer_source_id", "network_id", "accepting_new_patients", "location_ref", "raw_specialty_code", "source_last_updated", "data_completeness", "raw_resource"];
  const upd = ["accepting_new_patients", "raw_specialty_code", "source_last_updated", "data_completeness", "raw_resource"];
  // full rows key on (npi, payer, network, location); coarse (network_id NULL,
  // Healthfirst) key on (npi, payer, location) via the partial unique index.
  const full = rows.filter((r) => r.network_id != null);
  const coarse = rows.filter((r) => r.network_id == null);
  if (full.length)
    stats.participation += await upsertChunked("provider_network_participation", cols,
      ["npi", "payer_source_id", "network_id", "location_ref"], upd, full);
  if (coarse.length)
    stats.participation += await upsertChunked("provider_network_participation", cols,
      ["npi", "payer_source_id", "location_ref"], upd, coarse, " WHERE network_id IS NULL");
  await upsertChunked(
    "payer_unmatched_npis",
    ["npi", "payer_source_id", "name", "network_name", "raw_specialty_code", "accepting_new_patients", "raw_resource", "last_seen_at"],
    ["npi", "payer_source_id"],
    ["name", "network_name", "raw_specialty_code", "accepting_new_patients", "raw_resource", "last_seen_at"],
    unmatchedBuf.splice(0).map((r) => ({ ...r, last_seen_at: new Date().toISOString() })),
  );
}

/** Turn one full-quality PractitionerRole (matched npi) into participation rows.
 *  `includes` = the page's _include'd resources, for resolving network names. */
async function participationRows(payerSourceId, npi, pr, includes) {
  const codes = specialtyCodes(pr);
  const rawSpecialty = codes.find((c) => isMentalHealthTaxonomy(c)) || codes[0] || null;
  const accepting = acceptingOf(pr);
  const lastUpdated = pr.meta?.lastUpdated || null;
  if (lastUpdated && (!stats.maxLastUpdated || lastUpdated > stats.maxLastUpdated)) stats.maxLastUpdated = lastUpdated;
  const nets = networksOf(pr, includes);
  const netList = nets.length ? nets : [{ name: `${source.name} (unspecified network)`, rawId: null }];
  const locList = (pr.location || []).map((l) => l.reference).filter(Boolean);
  const locs = locList.length ? locList : [""];
  const raw = JSON.stringify(stripNarrative(pr));
  for (const n of netList) {
    const nid = await networkId(payerSourceId, n.name, n.rawId);
    for (const loc of locs) {
      partBuf.push({
        npi, payer_source_id: payerSourceId, network_id: nid,
        accepting_new_patients: accepting, location_ref: loc,
        raw_specialty_code: rawSpecialty, source_last_updated: lastUpdated,
        data_completeness: "full", raw_resource: raw,
      });
    }
  }
}

// ── driver: enrich (default) — reverse-lookup our own NPIs ───────────────────
async function runEnrich(payerSourceId, headers) {
  // md5-random order (matches the reverse driver): a --limit sample is spread
  // across the full NPI range — low NPIs skew old/inactive and once produced a
  // misleading zero — and a partial run stays representative. Stable order, so
  // --resume still works and a sample is a strict prefix of the full run.
  const npis = await loadOurNpis(LIMIT, "random");
  console.log(`• ${source.name} enrich — probing ${npis.length} of our NPIs (directory is already NY + behavioral-health)`);
  const cp = RESUME ? readCheckpoint() : null;
  let start = cp?.index ?? 0;
  if (cp) Object.assign(stats, cp.stats || {});
  if (RESUME && cp) console.log(`  resuming at #${start}`);

  // NPIs whose lookup ultimately failed (e.g. sustained WAF block) — retried at
  // the end at concurrency 1 so a transient block never counts as a clean miss.
  const failedNpis = new Set();

  // Probe one NPI: Practitioner?identifier → PractitionerRole?practitioner.
  // No flush/checkpoint here — the chunk loop owns those so concurrent workers
  // never race on the shared buffers.
  async function probeNpi(npi, isRetry = false) {
    if (!isRetry) stats.probed++;
    let pracBundle;
    try { pracBundle = await fetchJson(source.fhirBaseUrl, `Practitioner?identifier=${NPI_SYSTEM}|${npi}`, headers, { tries: isRetry ? 6 : 3 }); }
    catch (err) { process.stdout.write(`\n  ! ${npi} practitioner lookup: ${err.message}`); failedNpis.add(npi); return; }
    failedNpis.delete(npi);
    const pracs = (pracBundle.entry || []).map((e) => e.resource).filter((r) => r?.resourceType === "Practitioner" && npiOf(r).npi === npi);
    if (!pracs.length) return; // not in this payer's directory
    stats.hits++;
    for (const prac of pracs) {
      let roleBundle;
      // Per-source role query (UHC needs _include=PractitionerRole:network —
      // its network-reference carries no display); default is the bare lookup.
      const roleRef = source.roleByPractitioner
        ? source.roleByPractitioner(prac.id, PAGE_COUNT)
        : `PractitionerRole?practitioner=Practitioner/${prac.id}&_count=${PAGE_COUNT}`;
      try { roleBundle = await fetchJson(source.fhirBaseUrl, roleRef, headers); }
      catch (err) { process.stdout.write(`\n  ! ${npi} role lookup: ${err.message}`); continue; }
      let url = null;
      do {
        if (url) roleBundle = await fetchJson(source.fhirBaseUrl, url, headers);
        stats.pages++;
        const includes = new Map();
        for (const e of roleBundle.entry || []) {
          const r = e.resource; if (!r) continue;
          if (r.resourceType && r.id) includes.set(`${r.resourceType}/${r.id}`, r);
          if (e.fullUrl) includes.set(e.fullUrl, r);
        }
        for (const e of roleBundle.entry || []) {
          const pr = e.resource;
          if (e.search?.mode === "include" || pr?.resourceType !== "PractitionerRole") continue;
          stats.matched++;
          await participationRows(payerSourceId, npi, pr, includes);
        }
        url = (roleBundle.link || []).find((l) => l.relation === "next")?.url || null;
      } while (url);
    }
  }

  // Process in chunks of CONCURRENCY; checkpoint the low-water-mark index after
  // each chunk so a killed run resumes chunk-aligned (idempotent re-probe).
  // Circuit breaker: if whole chunks keep failing (sustained WAF block), pause
  // for COOLDOWN_MS rather than hammering — the block clears, then we resume.
  let coolStreak = 0;
  for (let i = start; i < npis.length; i += CONCURRENCY) {
    const slice = npis.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map((n) => probeNpi(n)));
    if (partBuf.length >= 500) await flush();
    writeCheckpoint({ mode: "enrich", index: i + slice.length, stats });
    process.stdout.write(`\r  probed ${stats.probed}, in-network ${stats.hits}, roles ${stats.matched}…`);
    coolStreak = slice.every((n) => failedNpis.has(n)) ? coolStreak + 1 : 0;
    if (coolStreak >= 3) {
      console.log(`\n  ⚠ sustained WAF block — cooling down ${Math.round(COOLDOWN_MS / 1000)}s…`);
      await sleep(COOLDOWN_MS);
      coolStreak = 0;
    } else if (DELAY) await sleep(DELAY);
  }
  await flush();

  // Retry pass: re-probe anything that failed, sequentially with a longer pause,
  // until the set stops shrinking (transient WAF blocks clear; hard failures stay).
  let retryRound = 0;
  while (failedNpis.size && retryRound < 4) {
    const pending = [...failedNpis];
    console.log(`\n  retry pass ${++retryRound}: ${pending.length} failed NPIs (sequential)…`);
    for (const npi of pending) { await probeNpi(npi, true); await sleep(Math.max(DELAY, 250)); }
    await flush();
    if (failedNpis.size === pending.length) break; // no progress → give up
  }
  stats.errors = failedNpis.size;

  writeCheckpoint({ mode: "enrich", index: npis.length, stats });
  process.stdout.write("\n");
  console.log(`\n  probed ${stats.probed} NPIs → ${stats.hits} found in ${source.name}, ${stats.matched} roles, ${stats.participation} participation rows`);
  if (stats.errors) console.log(`  ⚠ ${stats.errors} NPIs still failing after retries (not counted as clean misses)`);
}

// ── driver: walk — general discovery over the payer's PractitionerRole feed ──
async function runWalk(payerSourceId, headers, known) {
  const codes = ONE_SPECIALTY ? [ONE_SPECIALTY] : Object.keys(MH_TAXONOMY);
  console.log(`• ${source.name} walk — ${codes.length} BH NUCC codes, state=${STATE || "any"}, _count=${PAGE_COUNT}`);
  const cp = RESUME ? readCheckpoint() : null;
  let startIdx = cp?.specialtyIndex ?? 0;
  if (cp) Object.assign(stats, cp.stats || {});

  const refCache = new Map();
  async function resolvePractitioner(ref, includes) {
    if (!ref) return { npi: null, name: null };
    const short = ref.replace(/^https?:\/\/[^/]+\/(api\/)?/, "");
    if (includes.has(ref)) return npiOf(includes.get(ref));
    if (includes.has(short)) return npiOf(includes.get(short));
    if (refCache.has(ref)) return npiOf(refCache.get(ref));
    try { const r = await fetchJson(source.fhirBaseUrl, ref, headers); refCache.set(ref, r); return npiOf(r); }
    catch { return { npi: null, name: null }; }
  }

  outer: for (let si = startIdx; si < codes.length; si++) {
    const code = codes[si];
    let url = cp && cp.specialtyIndex === si && cp.nextUrl ? cp.nextUrl : (() => {
      const u = new URL(source.fhirBaseUrl.replace(/\/$/, "/") + "PractitionerRole");
      u.searchParams.set("specialty", `${NUCC_SYSTEM}|${code}`);
      // Per-payer include set (Cigna needs :network to resolve network names).
      const incs = source.includes || ["PractitionerRole:practitioner", "PractitionerRole:location"];
      for (const inc of incs) u.searchParams.append("_include", inc);
      u.searchParams.set("_count", String(PAGE_COUNT));
      return u.toString();
    })();
    console.log(`\n[${si + 1}/${codes.length}] ${code} (${taxLabel(code) || code})`);
    let pageInSpecialty = 0;
    while (url) {
      const bundle = await fetchJson(source.fhirBaseUrl, url, headers);
      stats.pages++; pageInSpecialty++;
      const includes = new Map();
      for (const e of bundle.entry || []) {
        const r = e.resource; if (!r) continue;
        if (r.resourceType && r.id) includes.set(`${r.resourceType}/${r.id}`, r);
        if (e.fullUrl) includes.set(e.fullUrl, r);
      }
      for (const e of bundle.entry || []) {
        const pr = e.resource;
        if (pr?.resourceType !== "PractitionerRole") continue;
        stats.scanned++;
        if (STATE) { const st = statesOf(pr, includes); if (st.size && !st.has(STATE)) continue; }
        const { npi, name } = await resolvePractitioner(pr.practitioner?.reference, includes);
        if (!npi) continue;
        const bhCode = specialtyCodes(pr).find((c) => isMentalHealthTaxonomy(c)) || null;
        const inOurs = known.has(npi);
        if (!bhCode && !inOurs) continue;
        stats.kept++;
        if (inOurs) { stats.matched++; await participationRows(payerSourceId, npi, pr, includes); }
        else {
          stats.unmatched++;
          const nets = networksOf(pr, includes);
          unmatchedBuf.push({
            npi, payer_source_id: payerSourceId, name,
            network_name: nets[0]?.name || null,
            raw_specialty_code: bhCode || specialtyCodes(pr)[0] || code,
            accepting_new_patients: acceptingOf(pr), raw_resource: JSON.stringify(stripNarrative(pr)),
          });
        }
        if (partBuf.length >= 500 || unmatchedBuf.length >= 500) await flush();
        if (stats.scanned % 200 === 0) process.stdout.write(`\r  scanned ${stats.scanned}, matched ${stats.matched}, unmatched ${stats.unmatched}…`);
        if (stats.scanned >= LIMIT) { await flush(); break outer; }
      }
      url = (bundle.link || []).find((l) => l.relation === "next")?.url || null;
      writeCheckpoint({ mode: "walk", specialtyIndex: si, nextUrl: url, stats });
      await sleep(DELAY);
      if (pageInSpecialty >= MAX_PAGES) { console.log(`\n  hit --max-pages (${MAX_PAGES})`); break; }
    }
    writeCheckpoint({ mode: "walk", specialtyIndex: si + 1, nextUrl: null, stats });
  }
  await flush();
  process.stdout.write("\n");
  console.log(`\n  scanned ${stats.scanned} roles across ${stats.pages} pages → kept ${stats.kept}: matched ${stats.matched}, unmatched ${stats.unmatched} (parked)`);
}

// ── driver: locbatch — Path B: NY-location-scoped walk (Humana) ──────────────
// Phase 1: enumerate Location?address-state=NY (ids cached to <checkpoint>.locations).
// Phase 2: batch ids into location= OR-lists (--loc-batch, default 50 — measured
// 2026-07-11: 50 ids (3.3k URL) OK, 75+ (≥5k URL) gets bounced to a Firely Auth
// HTML page with HTTP 200; POST _search is Akamai-403'd, so GET only), walk
// PractitionerRole?location=<batch> following link.next per batch. NY-bounded by
// construction (no client-side state filter needed); BH-filtered client-side.
// Matched NPIs → participation rows; unmatched BH NPIs → payer_unmatched_npis.
async function runLocBatch(payerSourceId, headers, known) {
  const BATCH = Number(arg("loc-batch", 50));
  const LOC_PAGES = Number(arg("loc-pages", Infinity)); // bounded-slice: cap phase-1 pages
  const LOC_FILE = CHECKPOINT + ".locations";
  const cp = RESUME ? readCheckpoint() : null;
  if (cp) Object.assign(stats, cp.stats || {});

  // Phase 1 — enumerate NY location ids (resumable via checkpoint locNext).
  let locIds = null;
  if (RESUME) { try { locIds = JSON.parse(fs.readFileSync(LOC_FILE, "utf8")); } catch { /* not yet */ } }
  if (!locIds || (cp && cp.locNext)) {
    locIds = locIds || [];
    let url = cp?.locNext || `Location?address-state=${STATE}&_count=${PAGE_COUNT}`;
    console.log(`• ${source.name} locbatch — phase 1: enumerating ${STATE} locations…`);
    let locPages = 0;
    while (url && locPages < LOC_PAGES) {
      locPages++;
      const bundle = await fetchJson(source.fhirBaseUrl, url, headers);
      stats.pages++;
      for (const e of bundle.entry || []) {
        const r = e.resource;
        if (r?.resourceType === "Location" && r.id) locIds.push(r.id);
      }
      url = (bundle.link || []).find((l) => l.relation === "next")?.url || null;
      if (!DRY_RUN) fs.writeFileSync(LOC_FILE, JSON.stringify(locIds));
      writeCheckpoint({ mode: "locbatch", locNext: url, batchIndex: 0, roleNext: null, stats });
      process.stdout.write(`\r  locations ${locIds.length}…`);
      if (DELAY) await sleep(DELAY);
    }
    console.log(`\n  ${locIds.length} ${STATE} locations enumerated`);
  }
  locIds = [...new Set(locIds)];

  // Phase 2 — batched role walk.
  const refCache = new Map();
  const nBatches = Math.ceil(locIds.length / BATCH);
  let startBatch = cp?.locNext ? 0 : (cp?.batchIndex ?? 0);
  console.log(`• ${source.name} locbatch — phase 2: ${nBatches} batches of ≤${BATCH} locations`);
  outer: for (let bi = startBatch; bi < nBatches; bi++) {
    const ids = locIds.slice(bi * BATCH, (bi + 1) * BATCH);
    let url = cp && cp.batchIndex === bi && cp.roleNext ? cp.roleNext
      : `PractitionerRole?location=${ids.join(",")}&_count=${PAGE_COUNT}&_include=PractitionerRole:practitioner`;
    while (url) {
      const bundle = await fetchJson(source.fhirBaseUrl, url, headers);
      stats.pages++;
      const includes = new Map();
      for (const e of bundle.entry || []) {
        const r = e.resource; if (!r) continue;
        if (r.resourceType && r.id) includes.set(`${r.resourceType}/${r.id}`, r);
        if (e.fullUrl) includes.set(e.fullUrl, r);
      }
      for (const e of bundle.entry || []) {
        const pr = e.resource;
        if (e.search?.mode === "include" || pr?.resourceType !== "PractitionerRole") continue;
        stats.scanned++;
        // Resolve NPI: page includes first, then a cached point fetch.
        let npi = null, name = null;
        const ref = pr.practitioner?.reference;
        if (ref) {
          const short = ref.replace(/^https?:\/\/[^/]+\/(api\/)?/, "");
          let prac = includes.get(ref) || includes.get(short) || refCache.get(ref);
          if (!prac) {
            try { prac = await fetchJson(source.fhirBaseUrl, ref, headers); refCache.set(ref, prac); } catch { /* skip */ }
          }
          ({ npi, name } = npiOf(prac));
        }
        if (!npi) continue;
        const bhCode = specialtyCodes(pr).find((c) => isMentalHealthTaxonomy(c)) || null;
        const inOurs = known.has(npi);
        if (!bhCode && !inOurs) continue; // not behavioral health, not ours → skip
        stats.kept++;
        if (inOurs) { stats.matched++; await participationRows(payerSourceId, npi, pr, includes); }
        else {
          stats.unmatched++;
          const nets = networksOf(pr, includes);
          unmatchedBuf.push({
            npi, payer_source_id: payerSourceId, name,
            network_name: nets[0]?.name || null,
            raw_specialty_code: bhCode || specialtyCodes(pr)[0] || null,
            accepting_new_patients: acceptingOf(pr), raw_resource: JSON.stringify(stripNarrative(pr)),
          });
        }
        if (partBuf.length >= 500 || unmatchedBuf.length >= 500) await flush();
        if (stats.scanned >= LIMIT) { await flush(); break outer; }
      }
      url = (bundle.link || []).find((l) => l.relation === "next")?.url || null;
      writeCheckpoint({ mode: "locbatch", locNext: null, batchIndex: bi, roleNext: url, stats });
      if (DELAY) await sleep(DELAY);
    }
    writeCheckpoint({ mode: "locbatch", locNext: null, batchIndex: bi + 1, roleNext: null, stats });
    process.stdout.write(`\r  batch ${bi + 1}/${nBatches} — scanned ${stats.scanned}, matched ${stats.matched}, unmatched ${stats.unmatched}…`);
  }
  await flush();
  process.stdout.write("\n");
  console.log(`\n  scanned ${stats.scanned} roles across ${stats.pages} pages → kept ${stats.kept}: matched ${stats.matched}, unmatched ${stats.unmatched} (parked)`);
}

// ── driver: reverse-lookup — point-query our NPIs (Cigna, Healthfirst) ───────
// One request per NPI via source.roleQuery(npi): Cigna uses practitioner.identifier
// (+ _include to resolve the network), Healthfirst uses practitioner.id (= NPI).
// Matched by construction, no crawl/pagination/cap. completeness 'full' → network
// + accepting rows; 'coarse' → one presence row (network NULL, accepting unknown).
async function runReverseLookup(payerSourceId, headers) {
  const npis = await loadOurNpis(LIMIT, "random");
  const coarse = source.completeness === "coarse";
  // Some payers (MVP) never populate _include — but publish a small, stable set
  // of network Organizations. Fetch them once; every page's includes map starts
  // from this cache so networksOf() resolves names without per-role fetches.
  const preloaded = new Map();
  if (source.preloadNetworkIncludes) {
    const bundle = await fetchJson(source.fhirBaseUrl, "Organization?type=ntwk&_count=200", headers);
    for (const e of bundle.entry || []) {
      const r = e.resource;
      if (r?.resourceType === "Organization" && r.id) preloaded.set(`Organization/${r.id}`, r);
    }
    console.log(`  preloaded ${preloaded.size} network organizations`);
  }
  console.log(`• ${source.name} reverse-lookup — ${npis.length} of our NPIs (${coarse ? "coarse presence" : "full network+accepting"}); no enumeration → no cap/truncation`);
  const cp = RESUME ? readCheckpoint() : null;
  let start = cp?.index ?? 0;
  if (cp) Object.assign(stats, cp.stats || {});
  const failedNpis = new Set();

  async function probe(npi, isRetry = false) {
    if (!isRetry) stats.probed++;
    let bundle;
    try { bundle = await fetchJson(source.fhirBaseUrl, source.roleQuery(npi), headers, { tries: isRetry ? 6 : 3 }); }
    catch (err) { process.stdout.write(`\n  ! ${npi}: ${err.message}`); failedNpis.add(npi); return; }
    failedNpis.delete(npi);
    // Follow link.next: Cigna/Healthfirst return few roles per NPI, but Anthem
    // publishes 50+ network×location roles per provider — without pagination the
    // _count cap silently truncates (caught on the 2026-07-13 proof run).
    const includes = new Map(preloaded);
    const roles = [];
    let nextUrl = null;
    do {
      if (nextUrl) {
        try { bundle = await fetchJson(source.fhirBaseUrl, nextUrl, headers, { tries: isRetry ? 6 : 3 }); }
        catch (err) { process.stdout.write(`\n  ! ${npi} page: ${err.message}`); break; }
      }
      for (const e of bundle.entry || []) {
        const r = e.resource; if (!r) continue;
        if (r.resourceType && r.id) includes.set(`${r.resourceType}/${r.id}`, r);
        if (e.fullUrl) includes.set(e.fullUrl, r);
      }
      // The bundle is NPI-scoped: match entries are this NPI's roles; _include'd
      // resources carry search.mode==='include' (skip them as "roles").
      for (const e of bundle.entry || []) {
        if (e.search?.mode !== "include" && e.resource?.resourceType === "PractitionerRole") roles.push(e.resource);
      }
      nextUrl = (bundle.link || []).find((l) => l.relation === "next")?.url || null;
    } while (nextUrl);
    if (!roles.length) return; // not in this payer's directory
    stats.hits++;
    if (coarse) {
      stats.matched++;
      const role0 = roles[0], codes = specialtyCodes(role0), lu = role0.meta?.lastUpdated || null;
      if (lu && (!stats.maxLastUpdated || lu > stats.maxLastUpdated)) stats.maxLastUpdated = lu;
      partBuf.push({
        npi, payer_source_id: payerSourceId, network_id: null, accepting_new_patients: "unknown",
        location_ref: "", raw_specialty_code: codes.find((c) => isMentalHealthTaxonomy(c)) || codes[0] || null,
        source_last_updated: lu, data_completeness: "coarse", raw_resource: JSON.stringify(stripNarrative(role0)),
      });
    } else {
      for (const pr of roles) { stats.matched++; await participationRows(payerSourceId, npi, pr, includes); }
    }
  }

  for (let i = start; i < npis.length; i += CONCURRENCY) {
    const slice = npis.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map((n) => probe(n)));
    if (partBuf.length >= 500) await flush();
    writeCheckpoint({ mode: "reverse", index: i + slice.length, stats });
    process.stdout.write(`\r  probed ${stats.probed}, in ${source.name} ${stats.hits}, roles ${stats.matched}…`);
    if (DELAY) await sleep(DELAY);
  }
  await flush();
  let round = 0;
  while (failedNpis.size && round < 4) {
    const pend = [...failedNpis];
    console.log(`\n  retry pass ${++round}: ${pend.length} failed NPIs…`);
    for (const npi of pend) { await probe(npi, true); await sleep(Math.max(DELAY, 250)); }
    await flush();
    if (failedNpis.size === pend.length) break;
  }
  stats.errors = failedNpis.size;
  writeCheckpoint({ mode: "reverse", index: npis.length, stats });
  process.stdout.write("\n");
  console.log(`\n  probed ${stats.probed} NPIs → ${stats.hits} in ${source.name}, ${stats.matched} roles, ${stats.participation} rows`);
  if (stats.errors) console.log(`  ⚠ ${stats.errors} NPIs still failing after retries`);
}

// ── Step-3 proof report ──────────────────────────────────────────────────────
async function report(payerSourceId) {
  if (!payerSourceId) {
    const rows = await sql`SELECT id FROM payer_sources WHERE slug = ${PAYER}`;
    if (!rows[0]) { console.log("\n(no payer_sources row yet — nothing to report)"); return; }
    payerSourceId = rows[0].id;
  }
  console.log("\n=== Step 3 — proof report ===");
  const [{ part }] = await sql`SELECT count(*)::int part FROM provider_network_participation WHERE payer_source_id = ${payerSourceId}`;
  const [{ npis }] = await sql`
    SELECT count(DISTINCT p.npi)::int npis FROM provider_network_participation p
    JOIN directory_providers d ON d.npi = p.npi WHERE p.payer_source_id = ${payerSourceId}`;
  const [{ nets }] = await sql`SELECT count(*)::int nets FROM payer_networks WHERE payer_source_id = ${payerSourceId}`;
  const [{ unmatched }] = await sql`SELECT count(*)::int unmatched FROM payer_unmatched_npis WHERE payer_source_id = ${payerSourceId}`;
  const acc = await sql`
    SELECT accepting_new_patients v, count(DISTINCT npi)::int n FROM provider_network_participation
    WHERE payer_source_id = ${payerSourceId} GROUP BY accepting_new_patients`;
  const accMap = Object.fromEntries(acc.map((r) => [r.v, r.n]));
  const acceptingNpis = accMap.accepting || 0;

  console.log(`  provider_network_participation rows: ${part}`);
  console.log(`  distinct NPIs matched to our directory: ${npis}`);
  console.log(`  distinct networks discovered:          ${nets}`);
  console.log(`  unmatched NPIs parked for review:      ${unmatched}`);
  console.log(`  matched NPIs by accepting flag: accepting=${accMap.accepting || 0}, not_accepting=${accMap.not_accepting || 0}, unknown=${accMap.unknown || 0}`);
  if (npis) console.log(`  → ${acceptingNpis}/${npis} matched providers (${((acceptingNpis / npis) * 100).toFixed(1)}%) flagged accepting=accepting`);

  const samples = await sql`
    SELECT d.name, d.npi, d.profession, d.subspecialty, n.network_name, p.accepting_new_patients
    FROM provider_network_participation p
    JOIN directory_providers d ON d.npi = p.npi
    JOIN payer_networks n ON n.id = p.network_id
    WHERE p.payer_source_id = ${payerSourceId}
    ORDER BY (p.accepting_new_patients = 'accepting') DESC, p.ingested_at DESC LIMIT 5`;
  console.log("\n  sample joined rows (our provider ↔ payer network + accepting status):");
  for (const s of samples) {
    console.log(`   • ${s.name} [NPI ${s.npi}] — ${s.profession}${s.subspecialty ? " / " + s.subspecialty : ""}  ⇒  ${s.network_name} · ${s.accepting_new_patients}`);
  }
}

// ── run ──────────────────────────────────────────────────────────────────────
if (REPORT_ONLY) {
  await report(null);
} else {
  const headers = await source.buildHeaders();
  if (WAIT_UNBLOCK) await preflightUnblock(headers);
  const payerSourceId = await ensurePayerSource();
  // Driver: explicit --mode wins, else the payer's configured default.
  const mode = arg("mode") ? MODE : (source.defaultMode || "enrich");
  console.log(`  driver: ${mode}`);
  if (mode === "walk") await runWalk(payerSourceId, headers, await loadKnownNpis());
  else if (mode === "locbatch") await runLocBatch(payerSourceId, headers, await loadKnownNpis());
  else if (mode === "reverse") await runReverseLookup(payerSourceId, headers);
  else await runEnrich(payerSourceId, headers);
  if (!DRY_RUN) {
    await sql`UPDATE payer_sources SET last_synced_at = now() WHERE id = ${payerSourceId}`;
    if (stats.maxLastUpdated) await sql`UPDATE payer_sources SET max_last_updated = ${stats.maxLastUpdated} WHERE id = ${payerSourceId} AND (max_last_updated IS NULL OR max_last_updated < ${stats.maxLastUpdated})`;
  }
  await report(payerSourceId);
}

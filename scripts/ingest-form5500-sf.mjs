#!/usr/bin/env node
// Form 5500-SF → sql/040 form5500_sf_filings (health/welfare universe only).
// The SMALL-EMPLOYER half of the plan registry: plans under ~100 participants
// file the short form instead of the full 5500. One invocation = one DOL
// dataset year, end to end:
//
//   node --env-file=.env.local scripts/ingest-form5500-sf.mjs --year=2024
//   [--dir=.harvest/form5500]   # where F_5500_SF_<year>_Latest.zip already sits
//
// SCOPE — HEALTH, mirroring the main form's 4A gate. The main loader qualifies a
// filing on `TYPE_WELFARE_BNFT_CODE ~ '4A' OR a Schedule A health contract`. The
// SF form carries NO Schedule A, so the gate reduces to the health-code test:
// SF_TYPE_WELFARE_BNFT_CODE contains '4A' (health, other than dental/vision).
// Pension-only SF filings (SF_TYPE_PENSION_BNFT_CODE set, no 4A) are skipped —
// same discipline as the main form skipping pension annuity contracts. The vast
// majority of SF filings are small 401(k)s, so most rows are dropped here.
//
// WHY psql AND NOT THE NEON HTTP DRIVER: identical to ingest-form5500.mjs — bulk
// loads go through COPY on the wire protocol; the HTTP driver dies at 300s. One
// psql, one transaction: a TEMP stage table (ON COMMIT DROP — Neon's pooler
// reuses backends and leaks temp tables between sessions otherwise), COPY streams
// inline, then a DISTINCT ON + ON CONFLICT upsert keyed ein+plan_number+plan_year
// where the newest DATE_RECEIVED wins, so re-runs and out-of-order year loads are
// both idempotent.
//
// GRAIN TRAP (shared with the main form): DOL datasets are per FORM year but late
// filers surface old plan years in new datasets, and short plan years can collide
// on (ein, pn, plan_year) within one file — the DISTINCT ON handles both.
// plan_year is derived from SF_PLAN_YEAR_BEGIN_DATE, never the dataset vintage.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DB = process.env.DATABASE_URL;
if (!DB) { console.error("DATABASE_URL not set"); process.exit(1); }
const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const YEAR = arg("year");
if (!/^\d{4}$/.test(YEAR || "")) { console.error("--year=YYYY required"); process.exit(1); }
const DIR = arg("dir", ".harvest/form5500");

const SF_ZIP = path.join(DIR, `F_5500_SF_${YEAR}_Latest.zip`);
if (!fs.existsSync(SF_ZIP)) {
  console.error(`missing ${SF_ZIP} — download from askebsa.dol.gov first`);
  process.exit(1);
}

const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

// ── CSV plumbing (same shape as ingest-form5500.mjs; SF file verified to have no
// embedded newlines in quoted fields, but commas inside quotes are common) ─────
function parseCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const csvField = (v) =>
  v === null || v === undefined || v === "" ? "" : `"${String(v).replace(/"/g, '""')}"`;
const csvRow = (vals) => vals.map(csvField).join(",") + "\n";

/** Stream a zip member's lines through fn(fields, header, isHeader). */
async function scanZipCsv(zip, onRow) {
  const un = spawn("unzip", ["-p", zip, "*.csv"], { stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  un.stderr.on("data", (d) => (err += d));
  let buf = "", header = null;
  un.stdout.setEncoding("utf8");
  for await (const chunk of un.stdout) {
    buf += chunk;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");
      if (!line) continue;
      const f = parseCsvLine(line);
      if (!header) { header = f.map((h) => h.trim()); onRow(f, header, true); continue; }
      onRow(f, header, false);
    }
  }
  const last = buf.replace(/\r$/, "");
  if (last) onRow(parseCsvLine(last), header, false);
  await new Promise((res, rej) =>
    un.on("close", (code) => (code === 0 ? res() : rej(new Error(`unzip exit ${code}: ${err.trim()}`)))));
}

/** Header-derived index; fails loudly if DOL moves a column. */
function indexOf(header, names) {
  const pos = new Map(header.map((h, i) => [h, i]));
  const map = {};
  const missing = [];
  for (const [k, h] of Object.entries(names)) {
    if (!pos.has(h)) missing.push(h);
    else map[k] = pos.get(h);
  }
  if (missing.length) {
    console.error(`FATAL: header missing expected columns:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }
  return map;
}

const isoDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s : null);
const yearOf = (s) => { const d = isoDate(s); return d ? Number(d.slice(0, 4)) : null; };
const int = (s) => (/^\d+$/.test(s || "") ? String(Number(s)) : null);
const bool = (s) => (s === "1" ? "t" : s === "0" ? "f" : null);
const pn3 = (s) => (/^\d{1,3}$/.test(s || "") ? s.padStart(3, "0") : null);

// ── single pass: SF main file — qualify HEALTH filings (welfare code ~ 4A) ─────
const SF_H = {
  ack_id: "ACK_ID", yr_begin: "SF_PLAN_YEAR_BEGIN_DATE",
  plan_name: "SF_PLAN_NAME", pn: "SF_PLAN_NUM",
  sponsor: "SF_SPONSOR_NAME", dba: "SF_SPONSOR_DFE_DBA_NAME",
  city: "SF_SPONS_US_CITY", state: "SF_SPONS_US_STATE", zip: "SF_SPONS_US_ZIP",
  ein: "SF_SPONS_EIN", business: "SF_BUSINESS_CODE",
  partcp: "SF_TOT_PARTCP_BOY_CNT",
  welfare: "SF_TYPE_WELFARE_BNFT_CODE", pension: "SF_TYPE_PENSION_BNFT_CODE",
  final: "SF_FINAL_FILING_IND", received: "DATE_RECEIVED",
};

console.log(`• form5500-SF ${YEAR}: scanning ${path.basename(SF_ZIP)}`);
let si = null;
const rows = [];
let scanned = 0, kept = 0, nonHealth = 0, malformed = 0;
await scanZipCsv(SF_ZIP, (f, header, isHeader) => {
  if (isHeader) { si = indexOf(header, SF_H); return; }
  scanned++;
  const ack = f[si.ack_id];
  const ein = f[si.ein];
  const pn = pn3(f[si.pn]);
  const planYear = yearOf(f[si.yr_begin]);
  if (!ack || !/^\d{9}$/.test(ein || "") || !pn || !planYear) { malformed++; return; }
  const welfare = f[si.welfare] || "";
  if (!welfare.includes("4A")) { nonHealth++; return; }   // the health gate
  kept++;
  rows.push(csvRow([
    ein, pn, planYear, ack,
    f[si.plan_name] || null, f[si.sponsor] || null, f[si.dba] || null,
    f[si.city] || null, f[si.state] || null, f[si.zip] || null,
    f[si.business] || null,
    int(f[si.partcp]),
    welfare || null, f[si.pension] || null, "t",
    bool(f[si.final]),
    isoDate(f[si.received]), YEAR,
  ]));
});
console.log(`  ${scanned} SF filings → ${kept} health (4A) kept, ` +
  `${nonHealth} non-health skipped, ${malformed} malformed [${elapsed()}]`);

// ── one psql, one transaction: stage → upsert ────────────────────────────────
const COLS = "ein, plan_number, plan_year, ack_id, plan_name, sponsor_name, sponsor_dba, " +
  "sponsor_city, sponsor_state, sponsor_zip, business_code, participants, welfare_codes, " +
  "pension_codes, has_health_code, final_filing, date_received, form_year";

const script =
`\\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE stage_sf (LIKE form5500_sf_filings INCLUDING DEFAULTS) ON COMMIT DROP;
COPY stage_sf (${COLS}) FROM STDIN WITH (FORMAT csv);
${rows.join("")}\\.
INSERT INTO form5500_sf_filings (${COLS})
SELECT DISTINCT ON (ein, plan_number, plan_year) ${COLS}
FROM stage_sf
ORDER BY ein, plan_number, plan_year, date_received DESC NULLS LAST
ON CONFLICT (ein, plan_number, plan_year) DO UPDATE SET
  ack_id = EXCLUDED.ack_id, plan_name = EXCLUDED.plan_name,
  sponsor_name = EXCLUDED.sponsor_name, sponsor_dba = EXCLUDED.sponsor_dba,
  sponsor_city = EXCLUDED.sponsor_city, sponsor_state = EXCLUDED.sponsor_state,
  sponsor_zip = EXCLUDED.sponsor_zip, business_code = EXCLUDED.business_code,
  participants = EXCLUDED.participants, welfare_codes = EXCLUDED.welfare_codes,
  pension_codes = EXCLUDED.pension_codes, has_health_code = EXCLUDED.has_health_code,
  final_filing = EXCLUDED.final_filing, date_received = EXCLUDED.date_received,
  form_year = EXCLUDED.form_year, loaded_at = now()
WHERE form5500_sf_filings.date_received IS NULL
   OR EXCLUDED.date_received IS NULL
   OR EXCLUDED.date_received >= form5500_sf_filings.date_received;
COMMIT;
SELECT 'form5500_sf_filings' AS t, count(*) FROM form5500_sf_filings;
`;

console.log(`• loading via psql (one transaction; ${kept} filings)`);
await new Promise((resolve, reject) => {
  const ps = spawn("psql", [DB, "-v", "ON_ERROR_STOP=1", "-q"], { stdio: ["pipe", "inherit", "pipe"] });
  let err = "";
  ps.stderr.on("data", (d) => (err += d));
  ps.on("error", reject);
  ps.on("close", (code) =>
    code === 0 ? resolve() : reject(new Error(`psql exit ${code}: ${err.trim()}`)));
  ps.stdin.on("error", reject);
  ps.stdin.end(script);
});
console.log(`✓ form5500-SF ${YEAR} loaded [${elapsed()}]`);

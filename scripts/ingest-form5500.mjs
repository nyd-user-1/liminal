#!/usr/bin/env node
// Form 5500 → sql/040 form5500_filings + form5500_schedule_a (health/welfare
// universe only). One invocation loads one DOL dataset year end-to-end:
//
//   node --env-file=.env.local scripts/ingest-form5500.mjs --year=2024
//   [--dir=.harvest/form5500]   # where the DOL zips already sit
//
// Reads the zips itself (unzip -p child) because the two files cross-reference:
// Schedule A is parsed FIRST to learn which ACK_IDs carry a health-adjacent
// contract (health/drug/HMO/PPO/stop-loss ind), then the main form qualifies a
// filing on TYPE_WELFARE_BNFT_CODE ~ '4A' OR that set — the brief's "Schedule A
// benefit-type or plan-characteristic 4A" rule, both directions. Schedule A
// rows then load only for qualifying filings, and only welfare rows (the
// pension annuity contracts in the same file are skipped).
//
// WHY psql AND NOT THE NEON HTTP DRIVER: same reason as ingest-nppes-full.mjs —
// bulk loads go through COPY on the wire protocol; the HTTP driver dies at 300s.
// Everything runs as ONE psql invocation, ONE transaction: temp staging tables
// are ON COMMIT DROP (Neon's pooler reuses backends — temp tables leak between
// sessions otherwise), COPY streams inline, then a DISTINCT ON + ON CONFLICT
// upsert keyed ein+plan_number+plan_year where the newest DATE_RECEIVED wins,
// making re-runs and out-of-order year loads both idempotent.
//
// GRAIN TRAP (measured, not assumed): DOL datasets are per FORM year but late
// filers surface old plan years in new datasets (a 2024-dataset row carried
// plan year 2021). plan_year is therefore derived from the plan-year BEGIN
// date, and (ein, pn, plan_year) can collide within one file (short plan
// years) — the DISTINCT ON handles that too. Orphaned Schedule A rows (their
// filing superseded by a newer ack) are pruned at the end of every run.

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

const MAIN_ZIP = path.join(DIR, `F_5500_${YEAR}_Latest.zip`);
const SCHA_ZIP = path.join(DIR, `F_SCH_A_${YEAR}_Latest.zip`);
for (const z of [MAIN_ZIP, SCHA_ZIP]) {
  if (!fs.existsSync(z)) { console.error(`missing ${z} — download from askebsa.dol.gov first`); process.exit(1); }
}

const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

// ── CSV plumbing (same shape as ingest-nppes-full.mjs; files verified to have
// no embedded newlines in quoted fields) ─────────────────────────────────────
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

/** Stream a zip member's lines through fn(fields, isHeader). */
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
const num = (s) => (/^-?\d+(\.\d+)?$/.test(s || "") ? s : null);
const bool = (s) => (s === "1" ? "t" : s === "0" ? "f" : null);
const pn3 = (s) => (/^\d{1,3}$/.test(s || "") ? s.padStart(3, "0") : null);

// ── pass 1: Schedule A — buffer welfare rows, learn health-adjacent acks ─────
const SCHA_H = {
  ack_id: "ACK_ID", form_id: "FORM_ID",
  yr_begin: "SCH_A_PLAN_YEAR_BEGIN_DATE",
  pn: "SCH_A_PLAN_NUM", ein: "SCH_A_EIN",
  carrier: "INS_CARRIER_NAME", carrier_ein: "INS_CARRIER_EIN", naic: "INS_CARRIER_NAIC_CODE",
  contract: "INS_CONTRACT_NUM", lives: "INS_PRSN_COVERED_EOY_CNT",
  from: "INS_POLICY_FROM_DATE", to: "INS_POLICY_TO_DATE",
  comm: "INS_BROKER_COMM_TOT_AMT", fees: "INS_BROKER_FEES_TOT_AMT",
  health: "WLFR_BNFT_HEALTH_IND", dental: "WLFR_BNFT_DENTAL_IND", vision: "WLFR_BNFT_VISION_IND",
  life: "WLFR_BNFT_LIFE_INSUR_IND", tdis: "WLFR_BNFT_TEMP_DISAB_IND", ltd: "WLFR_BNFT_LONG_TERM_DISAB_IND",
  unemp: "WLFR_BNFT_UNEMP_IND", drug: "WLFR_BNFT_DRUG_IND", stop: "WLFR_BNFT_STOP_LOSS_IND",
  hmo: "WLFR_BNFT_HMO_IND", ppo: "WLFR_BNFT_PPO_IND", indem: "WLFR_BNFT_INDEMNITY_IND",
  other: "WLFR_BNFT_OTHER_IND", other_text: "WLFR_TYPE_BNFT_OTH_TEXT",
  prem_earned: "WLFR_TOT_EARNED_PREM_AMT", prem_rcvd: "WLFR_PREMIUM_RCVD_AMT",
  claims: "WLFR_CLAIMS_PAID_AMT",
};

console.log(`• form5500 ${YEAR}: pass 1 — Schedule A (${path.basename(SCHA_ZIP)})`);
let ai = null;
const healthAcks = new Set();      // acks with ≥1 health-adjacent contract
const schaRows = [];               // buffered welfare rows (objects), filtered by ack later
let aScanned = 0, aPension = 0;
await scanZipCsv(SCHA_ZIP, (f, header, isHeader) => {
  if (isHeader) { ai = indexOf(header, SCHA_H); return; }
  aScanned++;
  const inds = {
    health: f[ai.health] === "1", dental: f[ai.dental] === "1", vision: f[ai.vision] === "1",
    life: f[ai.life] === "1", tdis: f[ai.tdis] === "1", ltd: f[ai.ltd] === "1",
    unemp: f[ai.unemp] === "1", drug: f[ai.drug] === "1", stop: f[ai.stop] === "1",
    hmo: f[ai.hmo] === "1", ppo: f[ai.ppo] === "1", indem: f[ai.indem] === "1",
    other: f[ai.other] === "1",
  };
  const isWelfare = Object.values(inds).some(Boolean) || !!f[ai.other_text];
  if (!isWelfare) { aPension++; return; }
  const ack = f[ai.ack_id];
  if (!ack) return;
  if (inds.health || inds.drug || inds.hmo || inds.ppo || inds.stop) healthAcks.add(ack);
  schaRows.push({
    ack,
    form_id: int(f[ai.form_id]),
    ein: /^\d{9}$/.test(f[ai.ein] || "") ? f[ai.ein] : null,
    pn: pn3(f[ai.pn]),
    plan_year: yearOf(f[ai.yr_begin]),
    carrier: f[ai.carrier] || null,
    carrier_ein: f[ai.carrier_ein] || null,
    naic: f[ai.naic] || null,
    contract: f[ai.contract] || null,
    lives: int(f[ai.lives]),
    from: isoDate(f[ai.from]),
    to: isoDate(f[ai.to]),
    comm: num(f[ai.comm]),
    fees: num(f[ai.fees]),
    inds,
    other_text: f[ai.other_text] || null,
    prem_earned: num(f[ai.prem_earned]),
    prem_rcvd: num(f[ai.prem_rcvd]),
    claims: num(f[ai.claims]),
  });
});
console.log(`  ${aScanned} rows → ${schaRows.length} welfare, ${aPension} pension-only skipped, ` +
  `${healthAcks.size} health-adjacent filings [${elapsed()}]`);

// ── pass 2: main form — qualify filings ──────────────────────────────────────
const MAIN_H = {
  ack_id: "ACK_ID", yr_begin: "FORM_PLAN_YEAR_BEGIN_DATE",
  plan_name: "PLAN_NAME", pn: "SPONS_DFE_PN",
  sponsor: "SPONSOR_DFE_NAME", dba: "SPONS_DFE_DBA_NAME",
  city: "SPONS_DFE_MAIL_US_CITY", state: "SPONS_DFE_MAIL_US_STATE", zip: "SPONS_DFE_MAIL_US_ZIP",
  ein: "SPONS_DFE_EIN", business: "BUSINESS_CODE",
  partcp: "TOT_PARTCP_BOY_CNT", active: "TOT_ACTIVE_PARTCP_CNT",
  welfare: "TYPE_WELFARE_BNFT_CODE",
  f_ins: "FUNDING_INSURANCE_IND", f_trust: "FUNDING_TRUST_IND", f_gen: "FUNDING_GEN_ASSET_IND",
  b_ins: "BENEFIT_INSURANCE_IND", b_trust: "BENEFIT_TRUST_IND", b_gen: "BENEFIT_GEN_ASSET_IND",
  n_scha: "NUM_SCH_A_ATTACHED_CNT",
  cb: "COLLECTIVE_BARGAIN_IND", final: "FINAL_FILING_IND",
  received: "DATE_RECEIVED",
};

console.log(`• form5500 ${YEAR}: pass 2 — main form (${path.basename(MAIN_ZIP)})`);
let mi = null;
const filingCsv = [];
const qualifyingAcks = new Map();  // ack -> plan_year (for Schedule A fallback)
let mScanned = 0, mSkipped = 0, mPension = 0;
await scanZipCsv(MAIN_ZIP, (f, header, isHeader) => {
  if (isHeader) { mi = indexOf(header, MAIN_H); return; }
  mScanned++;
  const ack = f[mi.ack_id];
  const ein = f[mi.ein];
  const pn = pn3(f[mi.pn]);
  const planYear = yearOf(f[mi.yr_begin]);
  if (!ack || !/^\d{9}$/.test(ein || "") || !pn || !planYear) { mSkipped++; return; }
  const welfare = f[mi.welfare] || "";
  const hasHealth = welfare.includes("4A");
  if (!hasHealth && !healthAcks.has(ack)) { mPension++; return; }
  qualifyingAcks.set(ack, planYear);
  filingCsv.push(csvRow([
    ein, pn, planYear, ack,
    f[mi.plan_name] || null, f[mi.sponsor] || null, f[mi.dba] || null,
    f[mi.city] || null, f[mi.state] || null, f[mi.zip] || null,
    f[mi.business] || null,
    int(f[mi.partcp]), int(f[mi.active]),
    welfare || null, hasHealth ? "t" : "f",
    bool(f[mi.f_ins]), bool(f[mi.f_trust]), bool(f[mi.f_gen]),
    bool(f[mi.b_ins]), bool(f[mi.b_trust]), bool(f[mi.b_gen]),
    int(f[mi.n_scha]), bool(f[mi.cb]), bool(f[mi.final]),
    isoDate(f[mi.received]), YEAR,
  ]));
});
console.log(`  ${mScanned} filings → ${filingCsv.length} health/welfare kept, ` +
  `${mPension} non-health skipped, ${mSkipped} malformed [${elapsed()}]`);

// ── emit Schedule A for qualifying filings only ──────────────────────────────
const schaCsv = [];
let aOrphan = 0, aBad = 0;
for (const r of schaRows) {
  if (!qualifyingAcks.has(r.ack)) { aOrphan++; continue; }
  const planYear = r.plan_year ?? qualifyingAcks.get(r.ack);
  if (!r.form_id || !r.ein || !r.pn || !planYear) { aBad++; continue; }
  schaCsv.push(csvRow([
    r.ack, r.form_id, r.ein, r.pn, planYear,
    r.carrier, r.carrier_ein, r.naic, r.contract, r.lives, r.from, r.to,
    r.comm, r.fees,
    r.inds.health ? "t" : "f", r.inds.dental ? "t" : "f", r.inds.vision ? "t" : "f",
    r.inds.drug ? "t" : "f", r.inds.life ? "t" : "f", r.inds.stop ? "t" : "f",
    r.inds.hmo ? "t" : "f", r.inds.ppo ? "t" : "f", r.inds.indem ? "t" : "f",
    r.other_text, r.prem_earned, r.prem_rcvd, r.claims, YEAR,
  ]));
}
console.log(`  Schedule A: ${schaCsv.length} rows for qualifying filings ` +
  `(${aOrphan} on non-health filings, ${aBad} malformed) [${elapsed()}]`);

// ── one psql, one transaction: stage → upsert → prune ────────────────────────
const F_COLS = "ein, plan_number, plan_year, ack_id, plan_name, sponsor_name, sponsor_dba, " +
  "sponsor_city, sponsor_state, sponsor_zip, business_code, participants, active_participants, " +
  "welfare_codes, has_health_code, funding_insurance, funding_trust, funding_gen_asset, " +
  "benefit_insurance, benefit_trust, benefit_gen_asset, num_sch_a, collective_bargain, " +
  "final_filing, date_received, form_year";
const A_COLS = "ack_id, form_id, ein, plan_number, plan_year, carrier_name, carrier_ein, " +
  "carrier_naic, contract_number, covered_lives, policy_from, policy_to, broker_comm_total, " +
  "broker_fees_total, benefit_health, benefit_dental, benefit_vision, benefit_drug, benefit_life, " +
  "benefit_stop_loss, benefit_hmo, benefit_ppo, benefit_indemnity, benefit_other_text, " +
  "premium_earned, premium_received, claims_paid, form_year";

const script =
`\\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE stage_f (LIKE form5500_filings INCLUDING DEFAULTS) ON COMMIT DROP;
CREATE TEMP TABLE stage_a (LIKE form5500_schedule_a INCLUDING DEFAULTS) ON COMMIT DROP;
COPY stage_f (${F_COLS}) FROM STDIN WITH (FORMAT csv);
${filingCsv.join("")}\\.
COPY stage_a (${A_COLS}) FROM STDIN WITH (FORMAT csv);
${schaCsv.join("")}\\.
INSERT INTO form5500_filings (${F_COLS})
SELECT DISTINCT ON (ein, plan_number, plan_year) ${F_COLS}
FROM stage_f
ORDER BY ein, plan_number, plan_year, date_received DESC NULLS LAST
ON CONFLICT (ein, plan_number, plan_year) DO UPDATE SET
  ack_id = EXCLUDED.ack_id, plan_name = EXCLUDED.plan_name,
  sponsor_name = EXCLUDED.sponsor_name, sponsor_dba = EXCLUDED.sponsor_dba,
  sponsor_city = EXCLUDED.sponsor_city, sponsor_state = EXCLUDED.sponsor_state,
  sponsor_zip = EXCLUDED.sponsor_zip, business_code = EXCLUDED.business_code,
  participants = EXCLUDED.participants, active_participants = EXCLUDED.active_participants,
  welfare_codes = EXCLUDED.welfare_codes, has_health_code = EXCLUDED.has_health_code,
  funding_insurance = EXCLUDED.funding_insurance, funding_trust = EXCLUDED.funding_trust,
  funding_gen_asset = EXCLUDED.funding_gen_asset, benefit_insurance = EXCLUDED.benefit_insurance,
  benefit_trust = EXCLUDED.benefit_trust, benefit_gen_asset = EXCLUDED.benefit_gen_asset,
  num_sch_a = EXCLUDED.num_sch_a, collective_bargain = EXCLUDED.collective_bargain,
  final_filing = EXCLUDED.final_filing, date_received = EXCLUDED.date_received,
  form_year = EXCLUDED.form_year, loaded_at = now()
WHERE form5500_filings.date_received IS NULL
   OR EXCLUDED.date_received IS NULL
   OR EXCLUDED.date_received >= form5500_filings.date_received;
INSERT INTO form5500_schedule_a (${A_COLS})
SELECT DISTINCT ON (ack_id, form_id) ${A_COLS}
FROM stage_a
ORDER BY ack_id, form_id
ON CONFLICT (ack_id, form_id) DO UPDATE SET
  ein = EXCLUDED.ein, plan_number = EXCLUDED.plan_number, plan_year = EXCLUDED.plan_year,
  carrier_name = EXCLUDED.carrier_name, carrier_ein = EXCLUDED.carrier_ein,
  carrier_naic = EXCLUDED.carrier_naic, contract_number = EXCLUDED.contract_number,
  covered_lives = EXCLUDED.covered_lives, policy_from = EXCLUDED.policy_from,
  policy_to = EXCLUDED.policy_to, broker_comm_total = EXCLUDED.broker_comm_total,
  broker_fees_total = EXCLUDED.broker_fees_total, benefit_health = EXCLUDED.benefit_health,
  benefit_dental = EXCLUDED.benefit_dental, benefit_vision = EXCLUDED.benefit_vision,
  benefit_drug = EXCLUDED.benefit_drug, benefit_life = EXCLUDED.benefit_life,
  benefit_stop_loss = EXCLUDED.benefit_stop_loss, benefit_hmo = EXCLUDED.benefit_hmo,
  benefit_ppo = EXCLUDED.benefit_ppo, benefit_indemnity = EXCLUDED.benefit_indemnity,
  benefit_other_text = EXCLUDED.benefit_other_text, premium_earned = EXCLUDED.premium_earned,
  premium_received = EXCLUDED.premium_received, claims_paid = EXCLUDED.claims_paid,
  form_year = EXCLUDED.form_year, loaded_at = now();
DELETE FROM form5500_schedule_a sa
  WHERE NOT EXISTS (SELECT 1 FROM form5500_filings f WHERE f.ack_id = sa.ack_id);
COMMIT;
SELECT 'form5500_filings' AS t, count(*) FROM form5500_filings
UNION ALL SELECT 'form5500_schedule_a', count(*) FROM form5500_schedule_a;
`;

console.log(`• loading via psql (one transaction; ${filingCsv.length} filings + ${schaCsv.length} schedule A)`);
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
console.log(`✓ form5500 ${YEAR} loaded [${elapsed()}]`);

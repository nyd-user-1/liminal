#!/usr/bin/env node
// CMS HCPCS Level II quarterly file → hcpcs_codes (sql/033). Idempotent:
// upsert on code, so re-running the same quarter is a no-op.
//
//   node --env-file=.env.local scripts/cms/ingest-hcpcs.mjs \
//     --zip=.harvest/cms/hcpcs-2026-q3.zip --release=HCPCS-2026-Q3
//   node --env-file=.env.local scripts/cms/ingest-hcpcs.mjs \
//     --url=https://www.cms.gov/files/zip/july-2026-alpha-numeric-hcpcs-file.zip \
//     --release=HCPCS-2026-Q3
//
// ── WHY THIS TABLE MAY STORE DESCRIPTOR TEXT AND cms_rvu MAY NOT ───────────
// The asymmetry is the whole point of this file. HCPCS Level II is CMS-
// maintained PUBLIC data: the codes AND their official descriptors are free to
// store, display, and ship. CPT (Level I) descriptors are AMA copyright and
// are not ours — hence cms_rvu has no description column and cpt_codes carries
// our own wording. Same namespace to a biller, two different legal regimes.
//
// Verified against the July 2026 file (2026-07-16): it contains ZERO numeric
// (Level I / CPT) codes and ZERO D-codes — CMS omits the ADA-copyrighted CDT
// dental series from the public alpha-numeric file. So no copyrighted text can
// ride in here. The ingest asserts that rather than trusting it (see below):
// if CMS ever starts shipping Level I rows, this must fail loudly, not quietly
// load AMA text into a displayable column.
//
// Behavioral-health relevance: Level II is where NY Medicaid managed care
// actually lives. H0004 (counseling), H0015 (IOP), H0031, H2019 are H-codes;
// G-codes cover Medicare behavioral/telehealth; J-codes are the long-acting
// injectable antipsychotics (J0401 aripiprazole…). Note: we hold no RATES for
// any of these — provider_rate_signals is CPT-only because the MRF scanner's
// code list was CPT-only. This table is the vocabulary, not the prices.
//
// ── SOURCE ─────────────────────────────────────────────────────────────────
// https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system/quarterly-update
// Free, no signup. Quarterly. A browser UA is sent on the download — CMS's CDN
// 403s some default agents. If a CMS page ever demands credentials, stop and
// report rather than working around it.
//
// ── WHAT THE FILE ACTUALLY IS (verified 2026-07-16) ────────────────────────
// FIXED-WIDTH, not CSV. 320-char records, positions per HCPC2026_recordlayout
// .txt shipped in the same zip:
//   1-5 code · 6-10 sequence · 11 record id · 12-91 long desc · 92-119 short
//   desc · 120-121 pricing · 230 coverage · 257-259 BETOS · 261 TOS ·
//   269-276 added · 277-284 action effective · 285-292 termination · 293 action
//
// TWO TRAPS, both of which silently corrupt a naive load:
//
//  1. A CODE IS NOT A RECORD. Long descriptors run past 80 chars and CONTINUE
//     onto further records with the same code and an incrementing sequence
//     (record id 3 = first, 4 = continuation). H0015's real descriptor spans
//     FOUR records. Reading only the first gives you a sentence chopped at
//     "...treatment program that" — which looks like data, not like a bug.
//     16,247 code records reassemble into 8,725 codes.
//  2. MODIFIER RECORDS SHARE THE FILE. 579 records have BLANK code positions
//     (1-3 are FILLER) and carry a 2-char MODIFIER at 4-5 instead — 'A1' =
//     "Dressing for one wound". They are a different entity, not codes, and
//     are skipped. Keying on positions 1-5 blindly would insert 579 junk rows
//     whose "code" is "   A1".

import fs from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Run with node --env-file=.env.local");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const arg = (name, dflt = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const ZIP = arg("zip");
const URL_ARG = arg("url");
const RELEASE = arg("release");
const HARVEST = ".harvest/cms";

if (!RELEASE) {
  console.error("--release=HCPCS-2026-Q3 is required (row-level provenance).");
  process.exit(1);
}

// effective_date = when THIS QUARTERLY RELEASE takes effect, derived from the
// release name (…-Q3 → Jul 1). It is deliberately NOT the per-code
// action_effective_date, which answers a different question ("when did this
// code last change?"). Override with --effective=YYYY-MM-DD.
const QUARTER_START = { Q1: "01-01", Q2: "04-01", Q3: "07-01", Q4: "10-01" };
const EFFECTIVE =
  arg("effective") ??
  (() => {
    const m = /^HCPCS-(\d{4})-(Q[1-4])$/.exec(RELEASE);
    return m ? `${m[1]}-${QUARTER_START[m[2]]}` : null;
  })();
if (!EFFECTIVE) {
  console.error(
    `Could not derive an effective date from --release=${RELEASE}. ` +
      `Use the HCPCS-YYYY-Qn form or pass --effective=YYYY-MM-DD.`,
  );
  process.exit(1);
}
if (!ZIP && !URL_ARG) {
  console.error("Pass --zip=<local path> or --url=<CMS zip url>.");
  process.exit(1);
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function download(url) {
  fs.mkdirSync(HARVEST, { recursive: true });
  const dest = path.join(HARVEST, path.basename(new URL(url).pathname));
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`• cached ${dest} (${(fs.statSync(dest).size / 1e6).toFixed(1)}MB)`);
    return dest;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `CMS returned ${res.status}. These files are meant to be free — do NOT work around ` +
            `an auth wall; confirm the URL and report it.`,
        );
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      console.log(`• downloaded ${dest} (${(fs.statSync(dest).size / 1e6).toFixed(1)}MB)`);
      return dest;
    } catch (e) {
      if (/do NOT work around/.test(e.message) || attempt === 3) throw e;
      console.error(`  download attempt ${attempt} failed (${e.message}), retrying…`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

function members(zip) {
  return execSync(`bsdtar -tf "${zip}"`, { encoding: "utf8" }).split("\n").filter(Boolean);
}
function readMember(zip, member) {
  const p = spawnSync("bsdtar", ["-xOf", zip, member], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (p.status !== 0) throw new Error(`bsdtar failed on ${member}: ${p.stderr}`);
  return p.stdout;
}

// Fixed-width slice, 1-indexed inclusive, trimmed. Lines are right-trimmed in
// the source, so a slice past end-of-line is legitimately empty, not an error.
const at = (line, a, b) => line.slice(a - 1, b).trim();
const txt = (v) => (v === "" ? null : v);
// CMS dates are YYYYMMDD; '00000000' and blanks both mean "none".
const date = (v) => (/^\d{8}$/.test(v) && v !== "00000000" ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null);

const POS = {
  code: [1, 5], seq: [6, 10], recId: [11, 11], long: [12, 91], short: [92, 119],
  pricing: [120, 121], coverage: [230, 230], betos: [257, 259], tos: [261, 261],
  added: [269, 276], actionEff: [277, 284], term: [285, 292], action: [293, 293],
};
const f = (line, k) => at(line, POS[k][0], POS[k][1]);

const zip = ZIP ?? (await download(URL_ARG));
if (!fs.existsSync(zip)) {
  console.error(`zip not found: ${zip}`);
  process.exit(1);
}
const member = members(zip).find((m) => /ANWEB.*\.txt$/i.test(m) && !/record\s*layout/i.test(m));
if (!member) throw new Error("ANWEB fixed-width .txt not found in zip");

const [{ db }] = await sql`select current_database() as db`;
console.log(`• ${db} ← ${zip} :: ${member} (${RELEASE}, effective ${EFFECTIVE})`);

const lines = readMember(zip, member).split("\n").filter((l) => l.trim() !== "");

// Group physical records by code, skipping modifier records (blank 1-3).
const byCode = new Map();
let modifierRecords = 0;
for (const line of lines) {
  if (at(line, 1, 3) === "") { modifierRecords++; continue; } // trap 2
  const code = f(line, "code");
  if (!byCode.has(code)) byCode.set(code, []);
  byCode.get(code).push(line);
}

// Guard the licensing boundary: Level I (numeric) or D (ADA/CDT) rows must
// never land in a table we display from. Fail loudly if CMS changes the file.
const forbidden = [...byCode.keys()].filter((c) => /^\d/.test(c) || /^D/i.test(c));
if (forbidden.length) {
  console.error(
    `REFUSING TO LOAD: ${forbidden.length} non-Level-II codes in the file ` +
      `(e.g. ${forbidden.slice(0, 5).join(", ")}). Level I is AMA-copyrighted and D-codes are ` +
      `ADA-copyrighted — their descriptors may not be stored. Inspect the file before proceeding.`,
  );
  process.exit(1);
}

const rows = [];
for (const [code, recs] of byCode) {
  // trap 1: reassemble the descriptor in sequence order.
  recs.sort((a, b) => f(a, "seq").localeCompare(f(b, "seq")));
  const long = recs.map((r) => f(r, "long")).filter(Boolean).join(" ");
  const head = recs[0];
  rows.push({
    code,
    long: txt(long),
    short: txt(f(head, "short")),
    pricing: txt(f(head, "pricing")),
    coverage: txt(f(head, "coverage")),
    betos: txt(f(head, "betos")),
    tos: txt(f(head, "tos")),
    added: date(f(head, "added")),
    actionEff: date(f(head, "actionEff")),
    term: date(f(head, "term")),
    action: txt(f(head, "action")),
  });
}

const multi = [...byCode.values()].filter((r) => r.length > 1).length;
console.log(
  `  ${lines.length} records → ${rows.length} codes ` +
    `(${multi} reassembled from continuations; ${modifierRecords} modifier records skipped)`,
);

const BATCH = 1000;
let written = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const col = (k) => batch.map((r) => r[k]);
  await sql.query(
    `INSERT INTO hcpcs_codes
       (code, long_description, short_description, pricing_indicator, coverage_code,
        bets_code, type_of_service, added_date, action_effective_date,
        termination_date, action_code, source_release, effective_date)
     SELECT * FROM unnest(
       $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
       $7::text[], $8::date[], $9::date[], $10::date[], $11::text[], $12::text[], $13::date[])
     ON CONFLICT (code) DO UPDATE SET
       long_description      = excluded.long_description,
       short_description     = excluded.short_description,
       pricing_indicator     = excluded.pricing_indicator,
       coverage_code         = excluded.coverage_code,
       bets_code             = excluded.bets_code,
       type_of_service       = excluded.type_of_service,
       added_date            = excluded.added_date,
       action_effective_date = excluded.action_effective_date,
       termination_date      = excluded.termination_date,
       action_code           = excluded.action_code,
       source_release        = excluded.source_release,
       effective_date        = excluded.effective_date,
       updated_at            = now()`,
    [
      col("code"), col("long"), col("short"), col("pricing"), col("coverage"),
      col("betos"), col("tos"), col("added"), col("actionEff"), col("term"),
      col("action"), batch.map(() => RELEASE), batch.map(() => EFFECTIVE),
    ],
  );
  written += batch.length;
}

const [{ n }] = await sql`select count(*)::int as n from hcpcs_codes`;
const [{ n: live }] = await sql`select count(*)::int as n from hcpcs_codes where termination_date is null`;
console.log(`✓ hcpcs_codes: ${written} upserted · ${n} total (${live} active)`);

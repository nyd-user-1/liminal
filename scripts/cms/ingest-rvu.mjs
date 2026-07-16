#!/usr/bin/env node
// CMS PFS Relative Value File → cms_rvu + cms_gpci + cms_pfs_config (sql/033).
// Idempotent and re-runnable: every write is an upsert keyed on the file's own
// grain, so a second pass over the same release is a no-op by construction.
//
//   node --env-file=.env.local scripts/cms/ingest-rvu.mjs \
//     --zip=.harvest/cms/rvu26c.zip --release=RVU26C --year=2026
//   node --env-file=.env.local scripts/cms/ingest-rvu.mjs \
//     --url=https://www.cms.gov/files/zip/rvu26c-updated-06-30-2026.zip \
//     --release=RVU26C --year=2026        # downloads to .harvest/cms/ first
//
// ── THE ONE RULE THIS SCRIPT EXISTS TO ENFORCE ─────────────────────────────
// The PPRRVU file's third column is DESCRIPTION — the AMA's CPT descriptor
// text. CMS ships it under CMS's license with the AMA; that license does not
// extend to us. Line 2 of the file says so in the file's own words:
//   "CPT codes and descriptions only are copyright 2026 American Medical
//    Association. All Rights Reserved."
// So column 2 is READ AND DISCARDED HERE, deliberately, and cms_rvu has no
// column to put it in. The bare five-digit codes are facts, not expression,
// and are ours to key on freely. Our own wording for those codes lives in
// cpt_codes. If you are tempted to "just add a description column so the admin
// page reads nicer": that is the exact move this comment exists to stop.
// See scripts/cms/LICENSE_NOTE.md.
//
// ── WHERE THE FILE COMES FROM ──────────────────────────────────────────────
// https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files
// Free: no key, no signup, no license click. Quarterly (A=Jan, B=Apr, C=Jul,
// D=Oct); take the newest — a later release RESTATES RVUs, it does not append.
// CMS's CDN 403s some default user agents, so the download below sends a
// browser UA. If a CMS page ever demands credentials, stop and report it
// rather than working around it.
//
// ── WHAT THE FILE ACTUALLY LOOKS LIKE (verified 2026-07-16 against RVU26C) ──
// NOT a plain CSV with a header on line 1. The real shape:
//   rows 1-5   copyright + release notes ("RELEASED 06/30/2026")
//   rows 6-10  a FIVE-ROW STACKED HEADER — column names split vertically, so
//              "NON-FAC / PE RVU" is rows 9+10 of one column
//   row 11+    data
// We therefore locate the header by finding the row whose first cell is
// literally "HCPCS" rather than trusting any row number: the junk rows have
// changed height across releases before, and a silently shifted offset would
// load RVUs into the wrong columns without erroring.
// Fields containing commas ARE quoted ("Asy carbamazepin 10,11-epxid"), so the
// parse is quote-aware — a naive split(",") misaligns ~1,037 rows.
//
// TWO PPRRVU FILES ship per release: _nonQPP and _QPP. The RVUs are IDENTICAL;
// only the embedded conversion factor differs (33.4009 vs 33.5675 for CY2026).
// The QPP file is also a subset (11,909 vs 19,356 rows). So RVUs load from
// nonQPP (the superset) and the QPP file is read ONLY for its CF.

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
const YEAR = Number(arg("year", "0"));
const HARVEST = ".harvest/cms";

if (!RELEASE || !YEAR) {
  console.error("--release=RVU26C and --year=2026 are required (row-level provenance).");
  process.exit(1);
}
if (!ZIP && !URL_ARG) {
  console.error("Pass --zip=<local path> or --url=<CMS zip url>.");
  process.exit(1);
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ── download (only when --url) ──────────────────────────────────────────────
// The whole zip lands before we read it: a zip's central directory is at the
// END of the file, so a streamed/partial archive is not readable at all.
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

// ── zip member access (bsdtar, same as scripts/nppes-sync.mjs) ──────────────
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

// ── quote-aware CSV ────────────────────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const num = (v) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
};
const txt = (v) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

// ── PPRRVU → cms_rvu ───────────────────────────────────────────────────────
// Column POSITIONS are resolved from the located header row, not hardcoded.
// Layout (verified RVU26C): 0 HCPCS · 1 MOD · 2 DESCRIPTION(dropped) ·
// 3 STATUS · 5 WORK · 6 PE NON-FAC · 8 PE FAC · 10 MP · 11 TOTAL NON-FAC ·
// 12 TOTAL FAC · 14 GLOB DAYS · 25 CONV FACTOR.
const C = {
  code: 0, mod: 1, status: 3, work: 5, peNf: 6, peF: 8,
  mp: 10, totNf: 11, totF: 12, glob: 14, cf: 25,
};
const BATCH = 1000;

function locateHeader(rows) {
  const i = rows.findIndex((r) => (r[0] ?? "").trim().toUpperCase() === "HCPCS");
  if (i === -1) {
    throw new Error(
      "PPRRVU: could not find the header row (first cell 'HCPCS'). CMS changed the file " +
        "shape — inspect it before trusting any offsets.",
    );
  }
  return i;
}

async function loadRvu(zip) {
  const member = members(zip).find((m) => /PPRRVU.*nonQPP\.csv$/i.test(m));
  if (!member) throw new Error("PPRRVU nonQPP CSV not found in zip");
  const rows = parseCsv(readMember(zip, member));
  const h = locateHeader(rows);
  console.log(`• ${member}: header at row ${h + 1}, data from row ${h + 2}`);

  const data = rows.slice(h + 1).filter((r) => (r[C.code] ?? "").trim() !== "");
  let cf = null;
  const batch = [];
  let written = 0;

  async function flush() {
    if (!batch.length) return;
    const col = (k) => batch.map((r) => r[k]);
    await sql.query(
      `INSERT INTO cms_rvu
         (hcpcs_code, modifier, status_code, work_rvu, pe_rvu_nonfacility,
          pe_rvu_facility, mp_rvu, total_rvu_nonfacility, total_rvu_facility,
          global_period, source_release, effective_year)
       SELECT * FROM unnest(
         $1::text[], $2::text[], $3::text[], $4::numeric[], $5::numeric[],
         $6::numeric[], $7::numeric[], $8::numeric[], $9::numeric[],
         $10::text[], $11::text[], $12::int[])
       ON CONFLICT (hcpcs_code, modifier, effective_year) DO UPDATE SET
         status_code           = excluded.status_code,
         work_rvu              = excluded.work_rvu,
         pe_rvu_nonfacility    = excluded.pe_rvu_nonfacility,
         pe_rvu_facility       = excluded.pe_rvu_facility,
         mp_rvu                = excluded.mp_rvu,
         total_rvu_nonfacility = excluded.total_rvu_nonfacility,
         total_rvu_facility    = excluded.total_rvu_facility,
         global_period         = excluded.global_period,
         source_release        = excluded.source_release,
         updated_at            = now()`,
      [
        col("code"), col("mod"), col("status"), col("work"), col("peNf"),
        col("peF"), col("mp"), col("totNf"), col("totF"), col("glob"),
        batch.map(() => RELEASE), batch.map(() => YEAR),
      ],
    );
    written += batch.length;
    batch.length = 0;
  }

  for (const r of data) {
    // NOTE: r[C.description] is never read. See the header comment.
    if (cf === null) cf = num(r[C.cf]);
    batch.push({
      code: r[C.code].trim(),
      mod: (r[C.mod] ?? "").trim(), // '' = base row; part of the PK, never NULL
      status: txt(r[C.status]),
      work: num(r[C.work]), peNf: num(r[C.peNf]), peF: num(r[C.peF]),
      mp: num(r[C.mp]), totNf: num(r[C.totNf]), totF: num(r[C.totF]),
      glob: txt(r[C.glob]),
    });
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  console.log(`  cms_rvu: ${written} rows upserted; CF in file = ${cf}`);
  return cf;
}

// ── GPCI → cms_gpci ────────────────────────────────────────────────────────
// Header is clean and on its own row here (row 3 in RVU26C), but it is located
// the same way — by content, not by index.
async function loadGpci(zip) {
  const member = members(zip).find((m) => /GPCI\d*\.csv$/i.test(m));
  if (!member) throw new Error("GPCI CSV not found in zip");
  const rows = parseCsv(readMember(zip, member));
  const h = rows.findIndex((r) => r.some((c) => /locality\s*number/i.test(c ?? "")));
  if (h === -1) throw new Error("GPCI: header row not found (no 'Locality Number' cell)");
  const head = rows[h].map((c) => (c ?? "").trim().toLowerCase());
  const at = (re) => head.findIndex((c) => re.test(c));
  const idx = {
    mac: at(/contractor|mac/), state: at(/^state$/), loc: at(/locality number/),
    name: at(/locality name/), work: at(/pw gpci/), pe: at(/pe gpci/), mp: at(/mp gpci/),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v === -1) throw new Error(`GPCI: column '${k}' not found in header: ${head.join("|")}`);
  }
  console.log(`• ${member}: header at row ${h + 1}`);

  const data = rows.slice(h + 1).filter((r) => (r[idx.state] ?? "").trim() !== "");
  const col = (k) => data.map((r) => r[idx[k]]?.trim() ?? null);
  await sql.query(
    `INSERT INTO cms_gpci
       (mac, state, locality_code, locality_name, gpci_work, gpci_pe, gpci_mp,
        source_release, effective_year)
     SELECT * FROM unnest(
       $1::text[], $2::text[], $3::text[], $4::text[], $5::numeric[],
       $6::numeric[], $7::numeric[], $8::text[], $9::int[])
     ON CONFLICT (state, locality_code, effective_year) DO UPDATE SET
       mac            = excluded.mac,
       locality_name  = excluded.locality_name,
       gpci_work      = excluded.gpci_work,
       gpci_pe        = excluded.gpci_pe,
       gpci_mp        = excluded.gpci_mp,
       source_release = excluded.source_release,
       updated_at     = now()`,
    [
      col("mac"), col("state"), col("loc"), col("name"),
      col("work"), col("pe"), col("mp"),
      data.map(() => RELEASE), data.map(() => YEAR),
    ],
  );
  console.log(`  cms_gpci: ${data.length} localities upserted`);
}

// ── conversion factors → cms_pfs_config ────────────────────────────────────
// Both CFs are read OUT OF THE FILES rather than typed in from a brief or a
// press release: the CF is a single number that moves every price we compute,
// and a stale one is invisible in the output. Each PPRRVU variant embeds its
// own CF in the CONV FACTOR column; we assert it is constant within the file
// before storing it, because "the CF" is only meaningful if it is one value.
function cfFromFile(zip, pattern) {
  const member = members(zip).find((m) => pattern.test(m));
  if (!member) throw new Error(`CF source not found for ${pattern}`);
  const rows = parseCsv(readMember(zip, member));
  const h = locateHeader(rows);
  const vals = new Set(
    rows.slice(h + 1)
      .filter((r) => (r[C.code] ?? "").trim() !== "")
      .map((r) => (r[C.cf] ?? "").trim())
      .filter(Boolean),
  );
  if (vals.size !== 1) {
    throw new Error(`${member}: expected ONE conversion factor, found ${vals.size}: ${[...vals]}`);
  }
  return { member, cf: Number([...vals][0]) };
}

async function loadConfig(zip) {
  const non = cfFromFile(zip, /PPRRVU.*nonQPP\.csv$/i);
  const qpp = cfFromFile(zip, /PPRRVU.*_QPP\.csv$/i);
  const entries = [
    ["conversion_factor_nonqpp", non.cf,
     `${RELEASE} ${non.member} CONV FACTOR column — applies to clinicians NOT qualifying as APM participants (the default).`],
    ["conversion_factor_qpp", qpp.cf,
     `${RELEASE} ${qpp.member} CONV FACTOR column — applies only to qualifying APM participants.`],
  ];
  await sql.query(
    `INSERT INTO cms_pfs_config (key, value, source, effective_year)
     SELECT * FROM unnest($1::text[], $2::numeric[], $3::text[], $4::int[])
     ON CONFLICT (key) DO UPDATE SET
       value = excluded.value, source = excluded.source,
       effective_year = excluded.effective_year, updated_at = now()`,
    [entries.map((e) => e[0]), entries.map((e) => e[1]), entries.map((e) => e[2]),
     entries.map(() => YEAR)],
  );
  console.log(`  cms_pfs_config: non-APM CF=${non.cf} · APM CF=${qpp.cf}`);
}

// ── main ───────────────────────────────────────────────────────────────────
const t0 = Date.now();
const zip = ZIP ?? (await download(URL_ARG));
if (!fs.existsSync(zip)) {
  console.error(`zip not found: ${zip}`);
  process.exit(1);
}
const [{ db }] = await sql`select current_database() as db`;
console.log(`• ${db} ← ${zip} (${RELEASE}, CY${YEAR})`);

await loadRvu(zip);
await loadGpci(zip);
await loadConfig(zip);

const [{ n: rvuN }] = await sql`select count(*)::int as n from cms_rvu where effective_year = ${YEAR}`;
const [{ n: gpciN }] = await sql`select count(*)::int as n from cms_gpci where effective_year = ${YEAR}`;
console.log(`✓ cms_rvu=${rvuN} · cms_gpci=${gpciN} [${((Date.now() - t0) / 1000).toFixed(1)}s]`);

#!/usr/bin/env node
// NPPES incremental sync → keeps sql/030 nppes_npi current between monthly
// full loads. Idempotent and resumable; safe to re-run any file, any time.
//
//   node --env-file=.env.local scripts/nppes-sync.mjs \
//     --weekly=.harvest/nppes/NPPES_Data_Dissemination_070626_071226_Weekly_V2.zip
//   node --env-file=.env.local scripts/nppes-sync.mjs \
//     --deactivations=.harvest/nppes/NPPES_Deactivated_NPI_Report_071326_V2.zip
//   (both flags may be passed together; --force re-applies an already-applied file)
//
// ── THE CADENCE, AND WHY A LOG TABLE EXISTS ─────────────────────────────────
// CMS publishes a FULL REPLACEMENT monthly and an INCREMENTAL every week. The
// weeklies are deltas: only NPIs that changed in that window, same 330 columns.
// So the maintenance contract is: load the monthly full (ingest-nppes-full.mjs),
// then apply each weekly published since, in order.
//
// Applying a weekly twice is harmless — it is an upsert, and the second pass
// writes identical values. SKIPPING one is the actual hazard: nothing about the
// table looks wrong afterwards, it is just quietly a week stale. So
// nppes_sync_log records every file that fully applied, and this script refuses
// to re-apply one unless --force. That log is the only way to answer "is this
// table current?" without diffing 9.7M rows.
//
// Resumable: the log row is written only AFTER the file finishes. A crash
// mid-file leaves no row, so a re-run redoes that file from the start — which
// upsert semantics make safe. There is deliberately no mid-file checkpoint: a
// weekly is ~35k rows and re-doing it costs seconds, so a checkpoint would be
// more moving parts than the thing it protects.
//
// SCOPE: the SPINE only (nppes_npi). The weekly zip also carries othername /
// endpoint / practice-location deltas; those tables are rebuilt wholesale by the
// monthly full load and change slowly, so they are not synced here. If a caller
// ever needs week-fresh DBAs, that is a real gap — see the report.

import { spawn } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";

const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const sql = neon(DB);
const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const WEEKLY = arg("weekly", "");
const DEACT = arg("deactivations", "");
const FORCE = process.argv.includes("--force");
if (!WEEKLY && !DEACT) {
  console.error("nothing to do: pass --weekly=<zip> and/or --deactivations=<zip>");
  process.exit(1);
}

const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

const applied = async (file) =>
  !FORCE &&
  (await sql.query("SELECT 1 FROM nppes_sync_log WHERE file_name = $1", [file])).length > 0;
const logApplied = (file, kind, rows) =>
  sql.query(
    `INSERT INTO nppes_sync_log (file_name, kind, rows_applied) VALUES ($1,$2,$3)
     ON CONFLICT (file_name) DO UPDATE SET rows_applied = EXCLUDED.rows_applied, applied_at = now()`,
    [file, kind, rows],
  );

// ── psql helpers (same COPY rationale as ingest-nppes-full.mjs) ──────────────
function psql(args, stdinData) {
  return new Promise((resolve, reject) => {
    const ps = spawn("psql", [DB, "-v", "ON_ERROR_STOP=1", "-q", ...args], {
      stdio: [stdinData === undefined ? "ignore" : "pipe", "inherit", "pipe"],
    });
    let err = "";
    ps.stderr.on("data", (d) => (err += d));
    ps.on("error", reject);
    ps.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`psql exit ${c}: ${err.trim()}`))));
    if (stdinData !== undefined) ps.stdin.end(stdinData);
  });
}
const exec = (text) => psql(["-c", text]);
const copyInto = (table, cols, rows) =>
  psql(["-c", `\\copy ${table} (${cols.join(",")}) FROM STDIN CSV`], rows.join(""));

const csvField = (v) =>
  v === null || v === undefined || v === "" ? "" : `"${String(v).replace(/"/g, '""')}"`;
const csvRow = (vals) => vals.map(csvField).join(",") + "\n";
const npDate = (s) => {
  const m = (s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};

function parseCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// ── 1. weekly incremental → upsert nppes_npi ────────────────────────────────
const COLS = [
  "npi", "entity_type", "org_name", "last_name", "first_name", "credential",
  "loc_addr1", "loc_addr2", "loc_city", "loc_state", "loc_zip", "loc_phone",
  "mail_phone", "sole_proprietor", "primary_taxonomy", "enumeration_date",
  "last_update", "deactivation_date", "reactivation_date",
];
const H = {
  npi: "NPI", entity_type: "Entity Type Code",
  org_name: "Provider Organization Name (Legal Business Name)",
  last_name: "Provider Last Name (Legal Name)", first_name: "Provider First Name",
  credential: "Provider Credential Text",
  loc_addr1: "Provider First Line Business Practice Location Address",
  loc_addr2: "Provider Second Line Business Practice Location Address",
  loc_city: "Provider Business Practice Location Address City Name",
  loc_state: "Provider Business Practice Location Address State Name",
  loc_zip: "Provider Business Practice Location Address Postal Code",
  loc_phone: "Provider Business Practice Location Address Telephone Number",
  mail_phone: "Provider Business Mailing Address Telephone Number",
  sole_proprietor: "Is Sole Proprietor",
  enumeration_date: "Provider Enumeration Date", last_update: "Last Update Date",
  deactivation_date: "NPI Deactivation Date", reactivation_date: "NPI Reactivation Date",
};

async function applyWeekly(zip) {
  const { execSync, spawn: sp } = await import("node:child_process");
  const member = execSync(`bsdtar -tf "${zip}"`, { encoding: "utf8" })
    .split("\n").map((s) => s.trim()).find((n) => /npidata_pfile_.*[0-9]\.csv$/.test(n));
  if (!member) throw new Error(`no npidata_pfile CSV inside ${zip}`);
  if (await applied(member)) {
    console.log(`• weekly ${member}: already applied — skipping (use --force to redo)`);
    return;
  }
  console.log(`• weekly ${member}: applying`);

  // Staging is a plain table (no generated columns — those are recomputed on
  // insert into the real table) and UNLOGGED: it is scratch, and not writing WAL
  // for it is free speed. Dropped at the end and on the next run.
  const STAGE = "nppes_npi_stage";
  await exec(
    `DROP TABLE IF EXISTS ${STAGE};
     CREATE UNLOGGED TABLE ${STAGE} (
       npi TEXT PRIMARY KEY, entity_type SMALLINT, org_name TEXT, last_name TEXT,
       first_name TEXT, credential TEXT, loc_addr1 TEXT, loc_addr2 TEXT, loc_city TEXT,
       loc_state TEXT, loc_zip TEXT, loc_phone TEXT, mail_phone TEXT, sole_proprietor TEXT,
       primary_taxonomy TEXT, enumeration_date DATE, last_update DATE,
       deactivation_date DATE, reactivation_date DATE)`,
  );

  const proc = sp("bsdtar", ["-xOf", zip, member], { stdio: ["ignore", "pipe", "ignore"] });
  let buf = "", idx = null, taxCols = [], rows = [], n = 0;
  const flush = async () => {
    if (!rows.length) return;
    const b = rows; rows = [];
    await copyInto(STAGE, COLS, b);
  };
  const handle = async (line) => {
    if (!line) return;
    const f = parseCsvLine(line);
    if (!idx) {
      const pos = new Map(f.map((h, i) => [h.trim(), i]));
      idx = {};
      for (const [k, v] of Object.entries(H)) {
        if (!pos.has(v)) throw new Error(`weekly header missing "${v}" — layout changed`);
        idx[k] = pos.get(v);
      }
      for (let i = 1; i <= 15; i++) {
        const c = pos.get(`Healthcare Provider Taxonomy Code_${i}`);
        const s = pos.get(`Healthcare Provider Primary Taxonomy Switch_${i}`);
        if (c !== undefined && s !== undefined) taxCols.push({ c, s });
      }
      return;
    }
    const npi = f[idx.npi];
    if (!/^\d{10}$/.test(npi || "")) return;
    let tax = null;
    for (const { c, s } of taxCols) {
      if (!f[c]) continue;
      if (!tax) tax = f[c];
      if ((f[s] || "").toUpperCase() === "Y") { tax = f[c]; break; }
    }
    rows.push(csvRow([
      npi, f[idx.entity_type] || null, f[idx.org_name] || null, f[idx.last_name] || null,
      f[idx.first_name] || null, f[idx.credential] || null, f[idx.loc_addr1] || null,
      f[idx.loc_addr2] || null, f[idx.loc_city] || null, f[idx.loc_state] || null,
      f[idx.loc_zip] || null, f[idx.loc_phone] || null, f[idx.mail_phone] || null,
      f[idx.sole_proprietor] || null, tax, npDate(f[idx.enumeration_date]),
      npDate(f[idx.last_update]), npDate(f[idx.deactivation_date]), npDate(f[idx.reactivation_date]),
    ]));
    n++;
    if (rows.length >= 100000) await flush();
  };
  proc.stdout.setEncoding("utf8");
  for await (const chunk of proc.stdout) {
    buf += chunk;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) await handle(l.replace(/\r$/, ""));
  }
  if (buf) await handle(buf.replace(/\r$/, ""));
  await flush();

  // The upsert. A weekly row is the CURRENT truth for that NPI, so every column
  // is overwritten — including back to NULL (a provider can clear a phone).
  const set = COLS.slice(1).map((c) => `${c} = EXCLUDED.${c}`).join(", ");
  await exec(
    `INSERT INTO nppes_npi (${COLS.join(",")})
     SELECT ${COLS.join(",")} FROM ${STAGE}
     ON CONFLICT (npi) DO UPDATE SET ${set}, ingested_at = now()`,
  );
  await exec(`DROP TABLE IF EXISTS ${STAGE}`);
  await logApplied(member, "weekly", n);
  console.log(`  ✓ weekly: ${n} NPIs upserted [${elapsed()}]`);
}

// ── 2. deactivation report → mark deactivated ───────────────────────────────
// The report is XLSX, not CSV — the only NPPES asset that is. It is 2 columns
// (NPI, deactivation date) and every cell is a sharedStrings reference, so this
// reads the two XML parts out of the zip directly rather than adding an xlsx
// dependency for a file this simple.
//
// It is a SAFETY NET, not the primary path: the monthly full and the weeklies
// both already carry NPI Deactivation Date, so this should be a no-op. It earns
// its place by being the authoritative cumulative list — if it ever marks NPIs
// the incremental path missed, that is a real bug worth seeing, and this script
// prints the count rather than silently converging.
async function applyDeactivations(zip) {
  const { execSync, spawn: sp } = await import("node:child_process");
  const member = execSync(`bsdtar -tf "${zip}"`, { encoding: "utf8" })
    .split("\n").map((s) => s.trim()).find((n) => /\.xlsx$/i.test(n));
  if (!member) throw new Error(`no xlsx inside ${zip}`);
  if (await applied(member)) {
    console.log(`• deactivations ${member}: already applied — skipping (--force to redo)`);
    return;
  }
  console.log(`• deactivations ${member}: applying`);

  const read = (entry) =>
    new Promise((res, rej) => {
      const p = sp("bsdtar", ["-xOf", zip, member, "--to-stdout"], { stdio: ["ignore", "pipe", "ignore"] });
      const bufs = [];
      p.stdout.on("data", (d) => bufs.push(d));
      p.on("close", () => res(Buffer.concat(bufs)));
      p.on("error", rej);
    });
  // xlsx-in-zip-in-zip: extract the .xlsx to a temp path, then read its parts.
  const tmp = `/tmp/nppes-deact-${process.pid}.xlsx`;
  fs.writeFileSync(tmp, await read());
  const part = (name) =>
    execSync(`bsdtar -xOf "${tmp}" ${name}`, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

  const shared = [];
  for (const m of part("xl/sharedStrings.xml").matchAll(/<si>(.*?)<\/si>/gs)) {
    shared.push([...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join(""));
  }
  const sheet = part("xl/worksheets/sheet1.xml");
  const pairs = [];
  for (const row of sheet.matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    // Capture the cell's ATTRIBUTES as one blob, then look for t="s" inside it.
    // Trying to pick the t attribute out inline (`<c[^>]*?(?: t="(\w)")?[^>]*>`)
    // silently never matches — the lazy prefix happily consumes ` t="s"` itself,
    // the optional group matches empty, and every cell resolves to its raw
    // sharedStrings INDEX instead of the string. That parses to 0 NPIs and looks
    // exactly like "no deactivations to apply".
    const cells = [...row[1].matchAll(/<c([^>]*)>(?:<v>(.*?)<\/v>)?<\/c>/gs)]
      .map(([, attrs, v]) => (v === undefined ? "" : /\bt="s"/.test(attrs) ? shared[Number(v)] : v));
    if (cells.length < 2) continue;
    const [npi, date] = cells;
    if (!/^\d{10}$/.test(npi || "")) continue;   // drops the title + header rows
    pairs.push([npi, npDate(date)]);
  }
  fs.unlinkSync(tmp);
  console.log(`  parsed ${pairs.length} deactivated NPIs from xlsx [${elapsed()}]`);

  const STAGE = "nppes_deact_stage";
  await exec(`DROP TABLE IF EXISTS ${STAGE};
              CREATE UNLOGGED TABLE ${STAGE} (npi TEXT PRIMARY KEY, deactivation_date DATE)`);
  for (let i = 0; i < pairs.length; i += 100000) {
    await copyInto(STAGE, ["npi", "deactivation_date"],
      pairs.slice(i, i + 100000).map((p) => csvRow(p)));
  }
  const changed = await sql.query(
    `UPDATE nppes_npi n SET deactivation_date = s.deactivation_date
     FROM ${STAGE} s
     WHERE n.npi = s.npi AND n.deactivation_date IS DISTINCT FROM s.deactivation_date
     RETURNING 1`,
  );
  const missing = await sql.query(
    `SELECT count(*)::int AS n FROM ${STAGE} s
     WHERE NOT EXISTS (SELECT 1 FROM nppes_npi n WHERE n.npi = s.npi)`,
  );
  await exec(`DROP TABLE IF EXISTS ${STAGE}`);
  await logApplied(member, "deactivation", pairs.length);
  console.log(
    `  ✓ deactivations: ${changed.length} rows corrected, ${missing[0].n} NPIs in the report but ` +
      `not in nppes_npi (expected 0 — a non-zero here means the full load is stale) [${elapsed()}]`,
  );
}

if (WEEKLY) await applyWeekly(WEEKLY);
if (DEACT) await applyDeactivations(DEACT);
console.log(`done [${elapsed()}]`);

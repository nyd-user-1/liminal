#!/usr/bin/env node
// ops/night-report.mjs — the night report, written by a script instead of a lead.
//
// Founder ruling (TASK-MONITOR Part 2): "my preference is that this report not
// rely on tokens and instead rely on a script that runs each morning." So there
// is no LLM here and there never should be. Everything below is a tally of
// things already on disk or already in the database:
//
//   • git log for the day      — commits, authors, subjects, churn by area
//   • docs/reports/<date>-*.md — which agents reported, and each headline.
//                                Nothing else captures the day's AGENT work.
//   • sql/ migrations added    — schema that moved
//   • sync_runs                — the harvest night: jobs, outcomes, durations
//   • corpus row counts        — growth MEASURED against the previous report's
//                                stored baseline, never asserted
//
// It writes one `lead_reports` row per day (sql/037). That table's own header
// says "the lead writes it, the founder annotates it" — so the cardinal rule
// here is that annotations survive. A row that already exists is left alone,
// full stop. `--force` will only replace a row this script wrote AND that
// nobody has touched since, proven by a checksum embedded in the body.
//
// Usage:
//   node ops/night-report.mjs                     # yesterday
//   node ops/night-report.mjs --date 2026-07-19   # a specific day (backfill)
//   node ops/night-report.mjs --dry-run           # print the markdown, write nothing
//   node ops/night-report.mjs --force             # replace, but only an untouched machine row
//
// Exit code is 0 for "did the job", including a deliberate skip — a protected
// row is a success, not a failure, and must not turn the harvest night red.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Same .env.local loader the harvest runner uses, so this works both standalone
// and as a job spawned by the runner (which already has the env).
for (const line of (() => {
  try {
    return fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n");
  } catch {
    return [];
  }
})()) {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

// ── the corpus. The tables whose growth is the point of the whole operation ───
// Ordered biggest-first so the report reads the way the database does.
const CORPUS = [
  "provider_rate_signals",
  "nppes_npi",
  "provider_network_participation",
  "org_network_rates",
  "form5500_schedule_a",
  "form5500_filings",
  "form5500_sf_filings",
  "directory_providers",
  "organizations",
  "fhir_healthcare_services",
  "fhir_locations",
];

// Churn is bucketed by top-level area so "what moved today" is legible without
// reading 84 file paths. Order matters — first match wins.
const AREAS = [
  ["app/", "app"],
  ["components/", "components"],
  ["lib/", "lib"],
  ["sql/", "sql"],
  ["ops/", "ops"],
  ["scripts/", "scripts"],
  ["docs/", "docs"],
];

const MARKER = "night-report:auto";
const VERSION = "v1";

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
function argValue(name) {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return null;
  const a = argv[i];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : (argv[i + 1] ?? null);
}
if (has("--help") || has("-h")) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 30).join("\n"));
  process.exit(0);
}
const DRY = has("--dry-run");
const FORCE = has("--force");

function yesterdayLocal() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localISODate(d);
}
/** YYYY-MM-DD in LOCAL time — toISOString() would silently shift the day. */
function localISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const DATE = argValue("date") ?? yesterdayLocal();
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) {
  console.error(`night-report: --date must be YYYY-MM-DD, got "${DATE}"`);
  process.exit(2);
}

// ── one window: the calendar day, local time ──────────────────────────────────
// Everything — commits, reports, migrations, sync_runs — is windowed to the same
// calendar day, so no section of the report means a different span of time than
// the one above it.
//
// A noon-to-noon "night of D" window was tried first and abandoned: the launchd
// runner fires at 01:04, so when this runs as a runner job on D+1 that window is
// still OPEN and the night's own rows are mid-flight. Under a calendar-day
// window every run of D (01:04–~05:30 that morning) is long finished by the time
// D's report is written. The harvest night that appears in D's report is the one
// that ran during D.
const nightStart = new Date(`${DATE}T00:00:00`);
const nightEnd = new Date(`${DATE}T00:00:00`);
nightEnd.setDate(nightEnd.getDate() + 1);

// Growth is only honest if the database is measured close to the end of the day
// being reported. Backfilling an older date must NOT present today's row counts
// as that day's — it says so instead, and stores no baseline (which would
// poison every future delta).
const FRESH_HOURS = 18;
const isFresh = Date.now() - new Date(`${DATE}T23:59:59`).getTime() < FRESH_HOURS * 3600 * 1000;

const log = (m) => console.log(`[night-report] ${m}`);

// ── git ───────────────────────────────────────────────────────────────────────
function git(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : "";
}

/** Commits for the day, each with its numstat churn. */
function collectGit() {
  const SEP = "\x01";
  const FS = "\x1f";
  const raw = git([
    "log",
    `--since=${DATE} 00:00:00`,
    `--until=${DATE} 23:59:59`,
    "--numstat",
    `--format=${SEP}%h${FS}%an${FS}%s`,
  ]);
  const commits = [];
  const areas = new Map();
  let added = 0;
  let removed = 0;
  let files = new Set();

  for (const block of raw.split("\x01").slice(1)) {
    const [header, ...rest] = block.split("\n");
    const [hash, author, subject] = header.split("\x1f");
    commits.push({ hash, author, subject });
    for (const line of rest) {
      const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line.trim());
      if (!m) continue;
      const ins = m[1] === "-" ? 0 : Number(m[1]);
      const del = m[2] === "-" ? 0 : Number(m[2]);
      const file = m[3];
      added += ins;
      removed += del;
      files.add(file);
      const area = AREAS.find(([prefix]) => file.startsWith(prefix))?.[1] ?? "other";
      const cur = areas.get(area) ?? { files: new Set(), added: 0, removed: 0 };
      cur.files.add(file);
      cur.added += ins;
      cur.removed += del;
      areas.set(area, cur);
    }
  }
  return { commits, areas, added, removed, files };
}

/** Migrations ADDED that day (a rename or an edit is not a new migration). */
function collectMigrations() {
  const out = git([
    "log",
    `--since=${DATE} 00:00:00`,
    `--until=${DATE} 23:59:59`,
    "--diff-filter=A",
    "--name-only",
    "--format=",
    "--",
    "sql/",
  ]);
  return [...new Set(out.split("\n").map((s) => s.trim()).filter((s) => s.endsWith(".sql")))].sort();
}

// ── reports on disk ───────────────────────────────────────────────────────────
/** The day's agent work. Headline = the file's H1; agent = the filename slug. */
function collectReports() {
  const dir = path.join(ROOT, "docs", "reports");
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((f) => f.startsWith(`${DATE}-`) && f.endsWith(".md"));
  } catch {
    return [];
  }
  return names.sort().map((file) => {
    let headline = "";
    try {
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      const h1 = text.split("\n").find((l) => /^#\s+\S/.test(l));
      headline = h1 ? h1.replace(/^#\s+/, "").trim() : "";
    } catch {
      /* an unreadable report is still a report that was filed */
    }
    return { file, slug: file.slice(DATE.length + 1, -3), headline };
  });
}

// ── postgres ──────────────────────────────────────────────────────────────────
// Credentials go in the environment, never argv — `ps` would expose the
// password otherwise. Same reasoning (and same shape) as ops/harvest/runner.mjs.
function pgEnvFromUrl(urlStr) {
  const u = new URL(urlStr);
  const env = { ...process.env };
  env.PGHOST = u.hostname;
  if (u.port) env.PGPORT = u.port;
  if (u.username) env.PGUSER = decodeURIComponent(u.username);
  if (u.password) env.PGPASSWORD = decodeURIComponent(u.password);
  env.PGDATABASE = u.pathname.replace(/^\//, "");
  env.PGSSLMODE = u.searchParams.get("sslmode") || "require";
  const cb = u.searchParams.get("channel_binding");
  if (cb) env.PGCHANNELBINDING = cb;
  return env;
}

/** One statement through psql. Never throws — a failure is data about the step.
 *  psql (not the HTTP driver) because count(*) over 16M rows outlives the
 *  undici 300s ceiling that has bitten this repo repeatedly (NYS-65). */
function psql(statement, pgEnv, timeoutMs = 10 * 60_000) {
  return new Promise((resolve) => {
    const child = spawn("psql", ["-v", "ON_ERROR_STOP=1", "-qAtF", "\x1f", "-c", statement], {
      cwd: ROOT,
      env: pgEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `psql spawn failed: ${e.message ?? e}` });
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ ok: true, rows: stdout.trim() ? stdout.trim().split("\n").map((l) => l.split("\x1f")) : [] });
      else resolve({ ok: false, error: (stderr.trim() || `psql exited ${code}`).slice(0, 500) });
    });
  });
}

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

// `psql -At` prints a multi-line text column across multiple output lines, which
// is indistinguishable from multiple rows. body_md is very much multi-line, so
// any column that can hold a newline is fetched as single-line base64 and
// decoded here. Learning this the hard way cost a silently-wrong checksum check.
const b64col = (expr) => `replace(encode(convert_to(${expr}, 'UTF8'), 'base64'), E'\\n', '')`;
const unb64 = (s) => Buffer.from(s ?? "", "base64").toString("utf8");

async function collectSyncRuns(pgEnv) {
  const r = await psql(
    `SELECT job, status, coalesce(duration_ms, 0), coalesce(to_char(started_at,'HH24:MI'),'--'), replace(coalesce(left(error, 160), ''), E'\\n', ' ')
       FROM sync_runs
      WHERE started_at >= ${lit(nightStart.toISOString())} AND started_at < ${lit(nightEnd.toISOString())}
      ORDER BY started_at`,
    pgEnv,
  );
  if (!r.ok) return { error: r.error, runs: [] };
  return { runs: r.rows.map(([job, status, ms, at, error]) => ({ job, status, ms: Number(ms), at, error })) };
}

async function collectCounts(pgEnv) {
  const union = CORPUS.map((t) => `SELECT ${lit(t)} AS t, count(*)::bigint AS n FROM ${t}`).join(" UNION ALL ");
  const r = await psql(union, pgEnv);
  if (!r.ok) return { error: r.error, counts: null };
  const counts = {};
  for (const [t, n] of r.rows) counts[t] = Number(n);
  return { counts };
}

/** The most recent machine baseline strictly before this date. */
async function previousBaseline(pgEnv) {
  const r = await psql(
    `SELECT report_date::text, ${b64col("body_md")} FROM lead_reports
      WHERE report_date < ${lit(DATE)} ORDER BY report_date DESC LIMIT 5`,
    pgEnv,
  );
  if (!r.ok) return null;
  for (const [date, encoded] of r.rows) {
    const body = unb64(encoded);
    // Must match what compose() emits — `<!-- night-report:auto:counts {...} -->`.
    const m = new RegExp(`${MARKER}:counts (\\{.*?\\})`).exec(body);
    if (m) {
      try {
        return { date, counts: JSON.parse(m[1]) };
      } catch {
        /* a corrupt stash is the same as none */
      }
    }
  }
  return null;
}

// ── composing the markdown ────────────────────────────────────────────────────
const nf = (n) => n.toLocaleString("en-US");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function prettyDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function compose({ gitData, migrations, reports, sync, counts, baseline }) {
  const L = [];
  L.push(`_Machine-written by \`ops/night-report.mjs\` — a tally of the day, not a judgment of it._`);
  L.push(`_Annotate freely below; a re-run will never overwrite an edited row._`);
  L.push("");

  // Headline numbers first — the founder should get the shape of the day in one line.
  const areaSummary = [...gitData.areas.entries()]
    .sort((a, b) => b[1].added + b[1].removed - (a[1].added + a[1].removed))
    .map(([a, v]) => `${a} ${v.files.size}`)
    .join(" · ");
  L.push(
    `**${gitData.commits.length} commits** · **${gitData.files.size} files** · +${nf(gitData.added)}/−${nf(gitData.removed)} lines · ` +
      `**${reports.length} agent reports** · **${migrations.length} migrations**`,
  );
  L.push("");

  // ── agent work ──
  L.push(`## Agent work`);
  if (!reports.length) {
    L.push(`No reports were filed in \`docs/reports/\` for ${DATE}.`);
  } else {
    for (const r of reports) L.push(`- **${r.slug}** — ${r.headline || "_(no headline)_"}  \n  \`docs/reports/${r.file}\``);
  }
  L.push("");

  // ── commits ──
  L.push(`## Commits`);
  if (!gitData.commits.length) {
    L.push(`No commits landed on ${DATE}.`);
  } else {
    if (areaSummary) L.push(`Files touched by area: ${areaSummary}.`);
    L.push("");
    for (const c of gitData.commits) L.push(`- \`${c.hash}\` ${c.subject}`);
  }
  L.push("");

  // ── migrations ──
  L.push(`## Migrations`);
  L.push(migrations.length ? migrations.map((m) => `- \`${m}\``).join("\n") : `No new \`sql/\` migrations.`);
  L.push("");

  // ── the harvest night ──
  L.push(`## Harvest night`);
  L.push(`_The runs that executed during ${DATE} (the runner fires at 01:04), local time._`);
  L.push("");
  if (sync.error) {
    L.push(`\`sync_runs\` could not be read: ${sync.error}`);
  } else if (!sync.runs.length) {
    L.push(`No \`sync_runs\` rows in the window — the runner did not report a night here.`);
  } else {
    const bad = sync.runs.filter((r) => r.status !== "ok");
    L.push(`| job | started | status | duration |`);
    L.push(`| --- | --- | --- | --- |`);
    for (const r of sync.runs) {
      const mins = r.ms >= 60_000 ? `${(r.ms / 60_000).toFixed(1)}m` : `${(r.ms / 1000).toFixed(1)}s`;
      L.push(`| \`${r.job}\` | ${r.at} | ${r.status === "ok" ? "ok" : `**${r.status}**`} | ${r.ms ? mins : "—"} |`);
    }
    L.push("");
    L.push(bad.length ? `**${bad.length} job(s) need attention:** ${bad.map((b) => `\`${b.job}\` — ${b.error || "no detail"}`).join("; ")}` : `All ${sync.runs.length} jobs green.`);
  }
  L.push("");

  // ── growth ──
  L.push(`## Corpus growth`);
  if (!isFresh) {
    // The honest case. Today's counts are not this date's counts.
    L.push(
      `_Not measured. This report was generated more than ${FRESH_HOURS}h after ${DATE} ended, so a count taken now ` +
        `would describe the database today, not on ${DATE}. Backfilled reports state this rather than present a ` +
        `misleading number, and store no baseline._`,
    );
  } else if (!counts.counts) {
    L.push(`Row counts unavailable: ${counts.error}`);
  } else {
    L.push(`_Measured ${new Date().toISOString()} against the live database._`);
    L.push("");
    L.push(`| table | rows | change |`);
    L.push(`| --- | ---: | ---: |`);
    for (const t of CORPUS) {
      const n = counts.counts[t];
      if (n === undefined) continue;
      let delta = "—";
      if (baseline?.counts?.[t] !== undefined) {
        const d = n - baseline.counts[t];
        delta = d === 0 ? "0" : d > 0 ? `+${nf(d)}` : `−${nf(Math.abs(d))}`;
      }
      L.push(`| \`${t}\` | ${nf(n)} | ${delta} |`);
    }
    L.push("");
    L.push(
      baseline
        ? `_Change is measured against the baseline stored in the ${baseline.date} report._`
        : `_No prior baseline was stored, so this run establishes one — the next report will show real deltas._`,
    );
  }
  L.push("");

  const body = L.join("\n").trimEnd();
  // Footer: the checksum proves whether a human has touched the row since we
  // wrote it, and the counts stash is how tomorrow measures growth.
  //
  // The checksum covers the WHOLE stored text, not just the prose above the
  // marker. An earlier version hashed only the part above it, which meant an
  // annotation appended at the bottom — the most natural place to add one —
  // left the checksum intact and `--force` happily destroyed it. The digest is
  // computed with the sha field itself blanked to a placeholder so the value
  // can be embedded in the very text it measures.
  const stash = counts.counts && isFresh ? `\n<!-- ${MARKER}:counts ${JSON.stringify(counts.counts)} -->` : "";
  const withPlaceholder = `${body}\n\n<!-- ${MARKER} ${VERSION} sha=${SHA_PLACEHOLDER} -->${stash}\n`;
  return withPlaceholder.replace(shaField(SHA_PLACEHOLDER), `$1${digestOf(withPlaceholder)}`);
}

const SHA_PLACEHOLDER = "PENDING";
/** Matches ONLY the sha field inside our own marker comment, so prose that
 *  happens to contain "sha=..." can never be mistaken for it. */
const shaField = (value = "[0-9a-f]+") => new RegExp(`(<!-- ${MARKER} \\S+ sha=)${value}`);
const digestOf = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);

/** Has anyone touched this row since the script wrote it? Re-derive the digest
 *  over the stored text with the sha field blanked back to its placeholder; any
 *  edit anywhere in the body — including one appended below the footer — moves
 *  the digest and the row becomes untouchable. */
function isUntouchedMachineRow(body) {
  const m = new RegExp(`<!-- ${MARKER} \\S+ sha=([0-9a-f]+) -->`).exec(body ?? "");
  if (!m) return false;
  return digestOf(body.replace(shaField(), `$1${SHA_PLACEHOLDER}`)) === m[1];
}

// ── main ──────────────────────────────────────────────────────────────────────
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("night-report: DATABASE_URL is not set.");
  process.exit(2);
}
const pgEnv = pgEnvFromUrl(url);

log(`composing ${DATE}${isFresh ? "" : " (backfill — growth not measurable)"}`);

const gitData = collectGit();
const migrations = collectMigrations();
const reports = collectReports();
const sync = await collectSyncRuns(pgEnv);
// Counting 16M+ rows is the slow part; skip it entirely when the answer would
// not be usable anyway.
const counts = isFresh ? await collectCounts(pgEnv) : { counts: null, error: "backfill" };
const baseline = isFresh ? await previousBaseline(pgEnv) : null;

const title = `Night report — ${prettyDate(DATE)}`;
const body = compose({ gitData, migrations, reports, sync, counts, baseline });

log(
  `${gitData.commits.length} commits · ${reports.length} reports · ${migrations.length} migrations · ` +
    `${sync.runs.length} sync runs${counts.counts ? ` · ${CORPUS.length} tables counted` : ""}`,
);

if (DRY) {
  console.log("\n" + "─".repeat(76) + `\n${title}\n` + "─".repeat(76) + "\n" + body);
  log("dry run — nothing written");
  process.exit(0);
}

// The protection rule. An existing row is the founder's until proven otherwise.
const existing = await psql(`SELECT ${b64col("body_md")} FROM lead_reports WHERE report_date = ${lit(DATE)}`, pgEnv);
if (!existing.ok) {
  console.error(`night-report: could not read lead_reports — ${existing.error}`);
  process.exit(1);
}
if (existing.rows.length) {
  const stored = unb64(existing.rows[0][0]);
  if (!FORCE) {
    log(`SKIPPED — a row for ${DATE} already exists. Annotations are never overwritten. (--force replaces an untouched machine row.)`);
    process.exit(0);
  }
  if (!isUntouchedMachineRow(stored)) {
    log(`SKIPPED — the row for ${DATE} was written or edited by a human. --force does not override that.`);
    process.exit(0);
  }
  log(`--force: the existing row is an untouched machine row, replacing it`);
}

const write = await psql(
  `INSERT INTO lead_reports (report_date, title, body_md)
   VALUES (${lit(DATE)}, ${lit(title)}, ${lit(body)})
   ON CONFLICT (report_date) DO UPDATE SET title = excluded.title, body_md = excluded.body_md, updated_at = now()`,
  pgEnv,
);
if (!write.ok) {
  console.error(`night-report: write failed — ${write.error}`);
  process.exit(1);
}
log(`wrote lead_reports row for ${DATE} — "${title}" (${body.length} chars)`);

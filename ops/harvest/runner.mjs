#!/usr/bin/env node
// liminal harvestd — the nightly wake-up that runs every due data job.
//
// launchd fires this at 01:04 local (ops/harvest/install.sh), wrapped in
// `caffeinate -is` so the machine stays awake for the duration. It replaces
// the nohup-and-hope era: jobs are declared in ops/harvest/jobs.json, MRF
// manifests dropped into .harvest/mrf/manifests/queue/ become jobs
// automatically, every run is ledgered to sync_runs (the same table the
// Vercel matview cron writes, so /insights shows both), and failures email
// LIMINAL_OPS_EMAIL. If the Mac slept through 01:04, launchd runs the job on
// next wake and the interval math below self-heals — nothing is ever "missed",
// only late.
//
// Design debts to ~/Code/hq: the lock/PID-liveness check (dev-server.ts), the
// detached-group spawn + group kill (same), and launchd bootstrap/bootout as
// the on/off switch (hq-dev.ts). What hq never had — sleep-holding, a retrying
// queue, failure email — lives here.
//
// One job at a time, on purpose: these jobs contend for the same laptop
// bandwidth and the same Neon writer, and payers WAF-ban concurrent greed
// (the UHC valve exists because of it). Sequential is the polite speed.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUN_DIR = path.join(ROOT, ".harvest", "runner");
const LOG_DIR = path.join(RUN_DIR, "logs");
const LOCK = path.join(RUN_DIR, "lock.json");
const STATE = path.join(RUN_DIR, "state.json");
const JOBS = path.join(ROOT, "ops", "harvest", "jobs.json");
const QUEUE_DIR = path.join(ROOT, ".harvest", "mrf", "manifests", "queue");
const DONE_DIR = path.join(ROOT, ".harvest", "mrf", "manifests", "done");

// Interval per cadence, deliberately under the nominal period so a run that
// fired late yesterday still qualifies today (20h < 24h, etc.).
const EVERY_HOURS = { day: 20, week: 140, month: 648 };
const DEFAULT_TIMEOUT_MIN = 360;
const DEFAULT_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 120_000;
const LOG_KEEP_DAYS = 45;

// ── env ───────────────────────────────────────────────────────────────────────
// The runner reads .env.local itself (children get it via their own
// --env-file). Never overrides anything launchd already set.
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

const sql = await (async () => {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { neon } = await import("@neondatabase/serverless");
    return neon(process.env.DATABASE_URL);
  } catch {
    return null; // the ledger is a convenience, not the job
  }
})();

// ── small utilities ───────────────────────────────────────────────────────────
const now = () => new Date();
const stamp = () => now().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const today = () => now().toISOString().slice(0, 10);
const log = (msg) => {
  const line = `[${now().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(RUN_DIR, "runner.log"), line + "\n");
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function tail(file, lines = 15) {
  try {
    const text = fs.readFileSync(file, "utf8");
    return text.split("\n").filter(Boolean).slice(-lines).join("\n");
  } catch {
    return "";
  }
}

// ── ledger (sync_runs, shared with the Vercel matview cron) ───────────────────
async function openRun(job) {
  if (!sql) return null;
  try {
    const [{ id }] = await sql`INSERT INTO sync_runs (job, trigger) VALUES (${job}, 'cron') RETURNING id`;
    return id;
  } catch {
    return null;
  }
}

async function closeRun(id, ok, ms, steps, error) {
  if (!sql || !id) return;
  try {
    await sql`
      UPDATE sync_runs
         SET finished_at = now(), duration_ms = ${ms},
             status = ${ok ? "ok" : "error"},
             steps = ${JSON.stringify(steps)}::jsonb,
             error = ${error ? String(error).slice(0, 2000) : null}
       WHERE id = ${id}`;
  } catch {
    /* ledger only */
  }
}

// ── failure email (Resend REST — this is plain node, not the Next app) ────────
async function emailFailures(results) {
  const key = process.env.LIMINAL_RESEND_API_KEY;
  const to = process.env.LIMINAL_OPS_EMAIL;
  const failed = results.filter((r) => !r.ok);
  if (!key || !to || failed.length === 0) return;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blocks = failed
    .map(
      (r) => `<p style="margin:0 0 4px;"><strong>${esc(r.id)}</strong> — ${esc(r.note)}</p>
        <pre style="margin:0 0 16px;padding:10px;background:#F4F2EC;border-radius:8px;font-size:12px;white-space:pre-wrap;">${esc(tail(r.logFile))}</pre>`,
    )
    .join("");
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.LIMINAL_EMAIL_FROM ?? "Leuk <onboarding@resend.dev>",
        to,
        subject: `Harvest runner — ${failed.length} of ${results.length} jobs failed`,
        html: `<p>Overnight run on ${today()}. Logs live in .harvest/runner/logs/.</p>${blocks}`,
      }),
    });
  } catch (e) {
    log(`failure email did not send: ${e.message ?? e}`);
  }
}

// ── job execution ─────────────────────────────────────────────────────────────
function runOnce(job, logFile) {
  return new Promise((resolve) => {
    const fd = fs.openSync(logFile, "a");
    fs.writeSync(fd, `\n── ${job.id} @ ${now().toISOString()} ──\n$ ${job.run}\n`);
    // Own process group so a timeout can kill the whole curl|gunzip|node chain,
    // not just the bash wrapper.
    const child = spawn("/bin/bash", ["-c", job.run], {
      cwd: ROOT,
      env: process.env,
      detached: true,
      stdio: ["ignore", fd, fd],
    });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fs.closeSync(fd);
      resolve(result);
    };
    const timeoutMs = (job.timeoutMinutes ?? DEFAULT_TIMEOUT_MIN) * 60_000;
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {}
      setTimeout(() => {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
      }, 30_000).unref();
      finish({ code: null, timedOut: true });
    }, timeoutMs);
    child.on("error", () => finish({ code: 127, timedOut: false }));
    child.on("exit", (code) => finish({ code, timedOut: false }));
  });
}

async function runJob(job) {
  const logFile = path.join(LOG_DIR, `${job.id}-${stamp()}.log`);
  const ledgerId = await openRun(`harvest:${job.id}`);
  const started = Date.now();
  const attempts = job.attempts ?? DEFAULT_ATTEMPTS;
  let note = "";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    log(`${job.id}: attempt ${attempt}/${attempts}`);
    const { code, timedOut } = await runOnce(job, logFile);
    const ms = Date.now() - started;
    if (code === 0) {
      await closeRun(ledgerId, true, ms, [{ step: job.id, ms }]);
      log(`${job.id}: ok in ${Math.round(ms / 1000)}s`);
      return { id: job.id, ok: true, note: "ok", logFile };
    }
    note = timedOut ? `timed out after ${job.timeoutMinutes ?? DEFAULT_TIMEOUT_MIN}m` : `exit ${code}`;
    log(`${job.id}: ${note}`);
    // The babysit.sh convention: a DB write error prints KILL SWITCH — retrying
    // would only re-fail against the same database. Stop and tell a human.
    if (tail(logFile, 40).includes("KILL SWITCH")) {
      note += " (KILL SWITCH — not retrying)";
      break;
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
  }

  const ms = Date.now() - started;
  await closeRun(ledgerId, false, ms, [{ step: job.id, ms, error: note }], note);
  return { id: job.id, ok: false, note, logFile };
}

// ── the queue: declared jobs + manifest drop-folder ───────────────────────────
function manifestJobs() {
  if (!fs.existsSync(QUEUE_DIR)) return [];
  return fs
    .readdirSync(QUEUE_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((f) => {
      const name = f.replace(/\.txt$/, "");
      const q = path.join(QUEUE_DIR, f);
      const load = `node --env-file=.env.local scripts/mrf/load-rate-signals.mjs --as-of=${today()} .harvest/mrf/${name}/*.csv`;
      let run;
      if (name.startsWith("stream-"))
        run = `bash scripts/mrf/run-stream.sh "${q}" "${name}" ${today()}`;
      else if (name.startsWith("2p-"))
        run = `bash scripts/mrf/run-two-pass.sh "${q}" "${name}" && ${load}`;
      else run = `bash scripts/mrf/run-payer.sh "${q}" "${name}" && ${load}`;
      return {
        id: `mrf-${name}`,
        every: "once",
        run,
        timeoutMinutes: 600,
        attempts: 2,
        _manifest: q,
        _manifestName: f,
      };
    });
}

function due(job, state) {
  const prev = state.jobs[job.id];
  if (job.every === "once") return !(prev?.lastState === "ok");
  const hours = EVERY_HOURS[job.every];
  if (!hours) return false;
  if (!prev?.lastStartedAt) return true;
  return Date.now() - new Date(prev.lastStartedAt).getTime() > hours * 3_600_000;
}

// ── main ──────────────────────────────────────────────────────────────────────
fs.mkdirSync(LOG_DIR, { recursive: true });

// One runner at a time (a manual `install.sh run` must not race the 01:04
// firing). PID-liveness check, stale locks unlinked — hq's dev-server pattern.
const lock = readJson(LOCK, null);
if (lock?.pid) {
  try {
    process.kill(lock.pid, 0);
    log(`another runner is alive (pid ${lock.pid}) — exiting`);
    process.exit(0);
  } catch {
    fs.rmSync(LOCK, { force: true });
  }
}
fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, startedAt: now().toISOString() }));

try {
  // prune old logs
  for (const f of fs.readdirSync(LOG_DIR)) {
    const full = path.join(LOG_DIR, f);
    if (Date.now() - fs.statSync(full).mtimeMs > LOG_KEEP_DAYS * 86_400_000) fs.rmSync(full, { force: true });
  }

  const state = readJson(STATE, { jobs: {} });
  const declared = readJson(JOBS, { jobs: [] }).jobs.filter((j) => !j.disabled);
  const queue = [...declared, ...manifestJobs()];
  const dueJobs = queue.filter((j) => due(j, state));
  log(`runner up — ${queue.length} known jobs, ${dueJobs.length} due`);

  const results = [];
  for (const job of dueJobs) {
    state.jobs[job.id] = { lastStartedAt: now().toISOString(), lastState: "running" };
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
    const result = await runJob(job);
    state.jobs[job.id].lastState = result.ok ? "ok" : "error";
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
    if (result.ok && job._manifest) {
      fs.mkdirSync(DONE_DIR, { recursive: true });
      fs.renameSync(job._manifest, path.join(DONE_DIR, `${today()}-${job._manifestName}`));
    }
    results.push(result);
  }

  await emailFailures(results);
  const failed = results.filter((r) => !r.ok);
  // The bell (sql/038): pipeline failures reach every admin in-app too, not
  // just over email. Best-effort like the rest of the ledger.
  if (sql && failed.length > 0) {
    try {
      await sql`
        INSERT INTO notifications (user_id, kind, title, body, href)
        SELECT id, 'sync_failure',
               ${`Harvest runner — ${failed.length} of ${results.length} jobs failed`},
               ${failed.map((r) => r.id).join(", ")}, '/insights'
        FROM users WHERE role = 'admin'`;
    } catch {
      /* ledger only */
    }
  }
  log(`runner done — ${results.length} ran, ${failed.length} failed`);
  process.exitCode = failed.length ? 1 : 0;
} finally {
  fs.rmSync(LOCK, { force: true });
}

import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";

// sync_runs (sql/035) — the maintenance ledger. Two writers share it: the
// nightly matview cron (job 'daily', app/api/cron/daily) and the local harvest
// runner (job 'harvest:<name>', ops/harvest/runner.mjs). One reader: the
// /insights sync-health card. Health is judged here, not in the component,
// so "red" means the same thing everywhere.

export type SyncStep = { step: string; ms: number; rows?: number; error?: string };

export type SyncRun = {
  id: string;
  job: string;
  trigger: string;
  /** ok | error | running | died — 'died' is a row still 'running' long after
   *  any plausible runtime (the process was killed mid-flight and never
   *  closed its row). */
  state: "ok" | "error" | "running" | "died";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  steps: SyncStep[];
  failedSteps: SyncStep[];
  error: string | null;
};

export type SyncHealth = {
  nightly: SyncRun | null;
  /** True once the nightly has run at least once but not in the last 26h —
   *  the cron fires daily, so a quiet day means it silently stopped. */
  nightlyStale: boolean;
  harvests: SyncRun[]; // latest run per harvest job, newest first
};

const STALE_HOURS = 26;
// Fallback cap for a row that recorded no timeout (the Vercel daily cron, which
// hard-dies at 300s, and any pre-sql/041 legacy row): still 'running' after this
// long means the process was killed and never closed its row.
const DIED_MINUTES = 30;
// A harvest that carries its own kill-timeout (timeout_ms, sql/041) is only
// "died" once it's run past that timeout plus a grace window — otherwise a
// legitimate multi-hour harvest showed false red mid-run (NYS-119). Grace covers
// the gap between the runner's SIGTERM→SIGKILL and its closeRun write.
const DIED_GRACE_MINUTES = 10;

function toRun(r: {
  id: string;
  job: string;
  trigger: string;
  status: string;
  started_at: Date;
  finished_at: Date | null;
  duration_ms: number | null;
  timeout_ms: number | null;
  steps: SyncStep[];
  error: string | null;
}): SyncRun {
  const running = r.status === "running";
  const diedAfterMs =
    r.timeout_ms != null ? r.timeout_ms + DIED_GRACE_MINUTES * 60_000 : DIED_MINUTES * 60_000;
  const died = running && Date.now() - r.started_at.getTime() > diedAfterMs;
  const steps = Array.isArray(r.steps) ? r.steps : [];
  return {
    id: r.id,
    job: r.job,
    trigger: r.trigger,
    // A DB status of 'suspect' (sql/041, NYS-124 — a success the runner didn't
    // trust) intentionally falls through to "error" here: it needs a human,
    // exactly like a failure, and the reason rides in `error`. Surfacing it as
    // its own amber badge is a /insights follow-up (that state union is owned by
    // the UI, not this repo).
    state: died ? "died" : running ? "running" : r.status === "ok" ? "ok" : "error",
    startedAt: isoDateTime(r.started_at),
    finishedAt: isoDateTime(r.finished_at),
    durationMs: r.duration_ms,
    steps,
    failedSteps: steps.filter((s) => s.error),
    error: r.error,
  };
}

/** The run ledger itself, newest first — feeds the /insights history table. */
export async function recentSyncRuns(limit = 30): Promise<SyncRun[]> {
  if (!hasDb) return [];
  const rows = (await sql`
    SELECT id, job, trigger, status, started_at, finished_at, duration_ms, timeout_ms, steps, error
    FROM sync_runs ORDER BY started_at DESC LIMIT ${limit}
  `) as Array<Parameters<typeof toRun>[0]>;
  return rows.map(toRun);
}

export async function syncHealth(): Promise<SyncHealth | null> {
  if (!hasDb) return null;
  const rows = (await sql`
    SELECT DISTINCT ON (job)
           id, job, trigger, status, started_at, finished_at, duration_ms, timeout_ms, steps, error
    FROM sync_runs
    ORDER BY job, started_at DESC
  `) as Array<Parameters<typeof toRun>[0]>;

  const runs = rows.map(toRun);
  const nightly = runs.find((r) => r.job === "daily") ?? null;
  const harvests = runs
    .filter((r) => r.job.startsWith("harvest:"))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 8);

  return {
    nightly,
    nightlyStale:
      nightly !== null && Date.now() - new Date(nightly.startedAt).getTime() > STALE_HOURS * 3_600_000,
    harvests,
  };
}

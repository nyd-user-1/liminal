import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";

// Database health, read straight from Postgres (TASK-MONITOR Part 3).
//
// Everything here comes from catalog and statistics views that ship with the
// server — pg_stat_activity, pg_stat_database, pg_stat_user_tables/indexes,
// pg_matviews, pg_settings — plus our own `sync_runs` ledger. No Neon API key
// is involved, so none of this degrades when that key is missing; the panels
// that DO need it are marked and say so themselves.
//
// Two rules this module exists to enforce:
//
//   1. Every number can name its source. Each check carries the view it was
//      read from, so a panel never shows a figure it can't attribute.
//   2. No PHI, ever. The only free text that could carry patient data is a
//      running query's SQL, so string literals are masked IN THE QUERY itself
//      (the pg_stat_activity read below) — the value never leaves Postgres, let
//      alone reaches a log or a browser.

// ── thresholds — the one place they live ──────────────────────────────────────
// Tuning the page is editing this object and nothing else. Every threshold is
// stated in the unit the check measures, because every alert has to be able to
// say "measured X, threshold Y".
export const THRESHOLDS = {
  /** Share of max_connections in use. Neon's pooler multiplexes, so the direct
   *  count sitting high is a real signal that something is leaking sessions. */
  connectionsWarnPct: 70,
  connectionsFailPct: 90,
  /** Buffer cache hit ratio. The textbook figure is 99%, and that number is
   *  wrong for this database: pg_stat_database counts CUMULATIVELY since the
   *  last stats reset, and this corpus is built by bulk loads and full-table
   *  matview rebuilds that read hundreds of millions of blocks exactly once.
   *  Measured 74% while healthy, so a 95% threshold would paint the page red
   *  permanently and train everyone to ignore it. Set where a real regression
   *  in the SERVING path would show. */
  cacheHitWarnPct: 85,
  cacheHitFailPct: 70,
  /** Dead tuples as a share of live rows on any one table — bloat that vacuum
   *  has not reclaimed. */
  deadTupleWarnPct: 20,
  deadTupleFailPct: 40,
  /** A query still running after this long is either a report nobody is waiting
   *  for or a lock nobody noticed. */
  longQueryWarnSeconds: 60,
  longQueryFailSeconds: 300,
  /** Matviews are rebuilt nightly. Past a day and a half, the app is serving
   *  yesterday's answers and calling them today's. */
  matviewStaleWarnHours: 36,
  matviewStaleFailHours: 72,
  /** Transaction age against the 200M autovacuum_freeze_max_age default. */
  txAgeWarn: 150_000_000,
  txAgeFail: 190_000_000,
  /** A nightly job that has not reported in this long has silently stopped. */
  jobSilentWarnHours: 30,
  jobSilentFailHours: 54,
} as const;

// Running queries are the one place PHI could leak onto this page: a WHERE
// clause can hold a name or an MRN. Every string literal is masked inside the
// query itself (see the pg_stat_activity read below), so the value never leaves
// Postgres — not to a log, not to the browser. The shape of the statement is
// all this page needs.

/** Statements that are slow on purpose: the nightly rebuild and vacuum work.
 *  Shown on the page, excluded from the long-query verdict. */
const MAINTENANCE = /^\s*(REFRESH\s+MATERIALIZED|VACUUM|ANALYZE|CREATE\s+(UNIQUE\s+)?INDEX|REINDEX|autovacuum:)/i;

export type CheckStatus = "failing" | "warning" | "healthy" | "unknown";

export type MonitorCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  /** The measured value, already formatted for display. */
  value: string;
  /** What would have to be true for this to be healthy, in words. */
  threshold: string;
  /** One line on what the check means and what is currently wrong. */
  detail: string;
  /** What to do about it when it is not green. */
  remediation: string;
  /** Where the number came from — a view name, so the page can attribute it. */
  source: string;
};

/** A proportion worth showing as the grid-of-squares meter. */
export type MonitorMeter = {
  id: string;
  label: string;
  pct: number | null;
  state: "healthy" | "warning" | "depleted";
  /** The measured reading in its own units, e.g. "13 of 112 connections". */
  primary: string;
  /** Provenance, shown under the meter. */
  secondary: string;
};

export type MatviewRow = {
  name: string;
  size: string;
  lastRefresh: string | null;
  ageHours: number | null;
  status: CheckStatus;
};

export type JobRow = {
  job: string;
  status: string;
  lastRun: string | null;
  ageHours: number | null;
  durationMs: number | null;
  error: string | null;
  health: CheckStatus;
};

export type TableRow = { name: string; rows: number; size: string; deadPct: number | null };

export type MonitorSnapshot = {
  available: boolean;
  generatedAt: string;
  checks: MonitorCheck[];
  meters: MonitorMeter[];
  matviews: MatviewRow[];
  jobs: JobRow[];
  tables: TableRow[];
  unusedIndexes: Array<{ table: string; index: string; size: string }>;
  longQueries: Array<{ pid: number; seconds: number; state: string; query: string; maintenance: boolean }>;
  databaseSize: string | null;
  /** Neon control-plane panels are gated on an API key that does not exist yet. */
  neon: { configured: boolean; reason: string };
};

const pct = (n: number) => `${n.toFixed(1)}%`;
const hoursSince = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : null);

/** Worst-of, so a group's headline status is never better than its worst row. */
function worst(...s: CheckStatus[]): CheckStatus {
  if (s.includes("failing")) return "failing";
  if (s.includes("warning")) return "warning";
  if (s.includes("unknown")) return "unknown";
  return "healthy";
}

function band(value: number, warn: number, fail: number, higherIsWorse = true): CheckStatus {
  if (higherIsWorse) return value >= fail ? "failing" : value >= warn ? "warning" : "healthy";
  return value <= fail ? "failing" : value <= warn ? "warning" : "healthy";
}

const EMPTY: MonitorSnapshot = {
  available: false,
  generatedAt: new Date(0).toISOString(),
  checks: [],
  meters: [],
  matviews: [],
  jobs: [],
  tables: [],
  unusedIndexes: [],
  longQueries: [],
  databaseSize: null,
  neon: { configured: false, reason: "No database is attached to this deployment." },
};

/**
 * One pass over the server's own statistics. Read-only and cheap — every query
 * hits a catalog or statistics view, none of them scan a base table, so this is
 * safe to run on every page view.
 */
export async function readMonitor(): Promise<MonitorSnapshot> {
  if (!hasDb) return { ...EMPTY, generatedAt: new Date().toISOString() };

  const [conn, cache, size, dead, idx, long, mviews, refreshes, jobs, txAge] = await Promise.all([
    sql`SELECT (SELECT count(*) FROM pg_stat_activity) AS used,
               (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn` as unknown as Promise<
      Array<{ used: number; max_conn: number }>
    >,
    sql`SELECT coalesce(sum(blks_hit), 0)::float8 AS hit, coalesce(sum(blks_read), 0)::float8 AS read
          FROM pg_stat_database WHERE datname = current_database()` as unknown as Promise<Array<{ hit: number; read: number }>>,
    sql`SELECT pg_size_pretty(pg_database_size(current_database())) AS size` as unknown as Promise<Array<{ size: string }>>,
    sql`SELECT relname, n_live_tup::int AS live, n_dead_tup::int AS dead,
               pg_size_pretty(pg_total_relation_size(relid)) AS size
          FROM pg_stat_user_tables
         WHERE n_live_tup > 1000
         ORDER BY n_live_tup DESC LIMIT 40` as unknown as Promise<
      Array<{ relname: string; live: number; dead: number; size: string }>
    >,
    sql`SELECT relname, indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
          FROM pg_stat_user_indexes
         WHERE idx_scan = 0 AND pg_relation_size(indexrelid) > 1048576
         ORDER BY pg_relation_size(indexrelid) DESC LIMIT 25` as unknown as Promise<
      Array<{ relname: string; indexrelname: string; size: string }>
    >,
    // The mask is written out here rather than interpolated: a tagged template
    // turns an interpolated value into a bound PARAMETER, which would send the
    // expression as a string literal instead of running it.
    sql`SELECT pid, extract(epoch FROM now() - query_start)::int AS seconds, state,
               regexp_replace(left(query, 200), '''[^'']*''', '''?''', 'g') AS query
          FROM pg_stat_activity
         WHERE state = 'active' AND query_start IS NOT NULL
           AND now() - query_start > interval '15 seconds'
           AND pid <> pg_backend_pid()
         ORDER BY query_start LIMIT 10` as unknown as Promise<
      Array<{ pid: number; seconds: number; state: string; query: string }>
    >,
    sql`SELECT matviewname AS name,
               pg_size_pretty(pg_total_relation_size(('public.' || matviewname)::regclass)) AS size
          FROM pg_matviews
         ORDER BY pg_total_relation_size(('public.' || matviewname)::regclass) DESC` as unknown as Promise<
      Array<{ name: string; size: string }>
    >,
    // Matview freshness has no catalog column — Postgres does not record when a
    // REFRESH last ran. Our own ledger does: the daily job writes one step per
    // view, so the newest error-free step naming a view IS its last good refresh.
    sql`SELECT elem->>'step' AS name, max(r.started_at) AS last_refresh
          FROM sync_runs r CROSS JOIN LATERAL jsonb_array_elements(r.steps) elem
         WHERE NOT (elem ? 'error')
         GROUP BY 1` as unknown as Promise<Array<{ name: string; last_refresh: Date | null }>>,
    // Run COUNT and the previous run time come back too, so silence can be
    // judged against each job's own observed cadence rather than one global
    // number. A one-off MRF manifest job that ran once and succeeded is
    // finished, not missing — see the jobs section below.
    sql`SELECT job,
               count(*)::int AS runs,
               (array_agg(status ORDER BY started_at DESC))[1] AS status,
               max(started_at) AS started_at,
               (array_agg(duration_ms ORDER BY started_at DESC))[1] AS duration_ms,
               (array_agg(error ORDER BY started_at DESC))[1] AS error,
               (array_agg(started_at ORDER BY started_at DESC))[2] AS prev_started_at
          FROM sync_runs GROUP BY job` as unknown as Promise<
      Array<{
        job: string;
        runs: number;
        status: string;
        started_at: Date;
        duration_ms: number | null;
        error: string | null;
        prev_started_at: Date | null;
      }>
    >,
    sql`SELECT coalesce(max(age(relfrozenxid)), 0)::bigint AS age
          FROM pg_class WHERE relkind IN ('r', 'm')` as unknown as Promise<Array<{ age: number }>>,
  ]);

  const checks: MonitorCheck[] = [];

  // ── connections ──
  const used = Number(conn[0]?.used ?? 0);
  const maxConn = Number(conn[0]?.max_conn ?? 0);
  const connPct = maxConn ? (used / maxConn) * 100 : 0;
  const connStatus = band(connPct, THRESHOLDS.connectionsWarnPct, THRESHOLDS.connectionsFailPct);
  checks.push({
    id: "connections",
    label: "Connection headroom",
    status: connStatus,
    value: `${used} of ${maxConn} (${pct(connPct)})`,
    threshold: `warn at ${THRESHOLDS.connectionsWarnPct}%, fail at ${THRESHOLDS.connectionsFailPct}% of max_connections`,
    detail:
      connStatus === "healthy"
        ? "Sessions are well inside the cap."
        : `${used} of ${maxConn} connections are open — ${pct(connPct)} of the cap.`,
    remediation:
      "Find the holders in pg_stat_activity. A climbing count with idle sessions usually means a route is opening connections outside the pooled client.",
    source: "pg_stat_activity · pg_settings",
  });

  // ── cache hit ratio ──
  const hit = Number(cache[0]?.hit ?? 0);
  const read = Number(cache[0]?.read ?? 0);
  const hitPct = hit + read > 0 ? (hit / (hit + read)) * 100 : null;
  const cacheStatus =
    hitPct === null ? "unknown" : band(hitPct, THRESHOLDS.cacheHitWarnPct, THRESHOLDS.cacheHitFailPct, false);
  checks.push({
    id: "cache-hit",
    label: "Buffer cache hit ratio",
    status: cacheStatus,
    value: hitPct === null ? "no reads recorded yet" : pct(hitPct),
    threshold: `warn below ${THRESHOLDS.cacheHitWarnPct}%, fail below ${THRESHOLDS.cacheHitFailPct}%`,
    detail:
      hitPct === null
        ? "Statistics have been reset and no blocks have been read since."
        : `${pct(hitPct)} of block reads were served from memory, counted cumulatively since the last statistics reset.`,
    remediation:
      "Read this one carefully before acting: it is a lifetime average, and every bulk load and full matview rebuild drags it down with one-time sequential reads that will never be re-read. A low number here is normal for this corpus. What matters is a fall relative to its own recent level while serving traffic.",
    source: "pg_stat_database",
  });

  // ── bloat ──
  const worstDead = dead
    .map((t) => ({ ...t, pct: t.live > 0 ? (t.dead / t.live) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)[0];
  const deadPct = worstDead?.pct ?? 0;
  const deadStatus = band(deadPct, THRESHOLDS.deadTupleWarnPct, THRESHOLDS.deadTupleFailPct);
  checks.push({
    id: "bloat",
    label: "Dead tuples",
    status: deadStatus,
    value: worstDead ? `${pct(deadPct)} on ${worstDead.relname}` : "none",
    threshold: `warn at ${THRESHOLDS.deadTupleWarnPct}%, fail at ${THRESHOLDS.deadTupleFailPct}% dead rows on any table`,
    detail: worstDead
      ? `${worstDead.relname} holds ${worstDead.dead.toLocaleString()} dead rows against ${worstDead.live.toLocaleString()} live.`
      : "No table is carrying meaningful dead rows.",
    remediation:
      "Autovacuum normally reclaims these. A table that stays high after a big delete or a bulk reload wants an explicit VACUUM (ANALYZE).",
    source: "pg_stat_user_tables",
  });

  // ── long-running queries ──
  // Nightly maintenance is SUPPOSED to be slow: a REFRESH MATERIALIZED VIEW over
  // a 698 MB view runs for minutes by design, every single night. Counting it
  // toward the verdict would raise the same alert forever, which is how a
  // monitor turns into wallpaper. Maintenance is still listed in the panel — it
  // is useful to see the rebuild working — but only application statements
  // decide the status.
  const appQueries = long.filter((q) => !MAINTENANCE.test(q.query));
  const longest = appQueries[0]?.seconds ?? 0;
  const longStatus = band(longest, THRESHOLDS.longQueryWarnSeconds, THRESHOLDS.longQueryFailSeconds);
  const maintenanceCount = long.length - appQueries.length;
  checks.push({
    id: "long-queries",
    label: "Long-running queries",
    status: longStatus,
    value: appQueries.length ? `${appQueries.length} over 15s, longest ${longest}s` : "none over 15s",
    threshold: `warn at ${THRESHOLDS.longQueryWarnSeconds}s, fail at ${THRESHOLDS.longQueryFailSeconds}s (application statements only)`,
    detail: appQueries.length
      ? `The longest active application statement has been running for ${longest}s.`
      : maintenanceCount
        ? `Nothing but maintenance is running long — ${maintenanceCount} refresh/vacuum statement(s) in flight, which is the nightly rebuild doing its job.`
        : "Nothing has been running long enough to notice.",
    remediation:
      "Read the masked statement in the panel below. An application query at this length usually means a missing index or a lock it is waiting behind.",
    source: "pg_stat_activity (string literals masked)",
  });

  // ── matview freshness ──
  const refreshedAt = new Map(refreshes.map((r) => [r.name, isoDateTime(r.last_refresh)]));
  const matviews: MatviewRow[] = mviews.map((m) => {
    const lastRefresh = refreshedAt.get(m.name) ?? null;
    const ageHours = hoursSince(lastRefresh);
    return {
      name: m.name,
      size: m.size,
      lastRefresh,
      ageHours,
      status:
        ageHours === null
          ? "unknown"
          : band(ageHours, THRESHOLDS.matviewStaleWarnHours, THRESHOLDS.matviewStaleFailHours),
    };
  });
  const staleCount = matviews.filter((m) => m.status === "failing" || m.status === "warning").length;
  // A view the ledger has never seen is its own case, not a stale one: it is
  // usually a view added to the rebuild plan since the last nightly run. Saying
  // "every view was rebuilt" while the status reads Unknown would be a lie.
  const unseen = matviews.filter((m) => m.status === "unknown");
  checks.push({
    id: "matview-staleness",
    label: "Materialized view freshness",
    status: worst(...matviews.map((m) => m.status)),
    value: `${matviews.filter((m) => m.status === "healthy").length} of ${matviews.length} fresh`,
    threshold: `rebuilt nightly — warn past ${THRESHOLDS.matviewStaleWarnHours}h, fail past ${THRESHOLDS.matviewStaleFailHours}h`,
    detail: [
      staleCount ? `${staleCount} view(s) are past their nightly cadence, so those surfaces are serving older answers.` : "",
      unseen.length
        ? `${unseen.map((m) => m.name).join(", ")} has no recorded rebuild yet — normally a view added to the plan since the last nightly run.`
        : "",
    ]
      .filter(Boolean)
      .join(" ") || "Every view was rebuilt within its nightly cadence.",
    remediation:
      "The harvest runner rebuilds these at the end of its pass. If a view is stale, read that night's runner log before refreshing by hand.",
    source: "pg_matviews · sync_runs steps",
  });

  // ── nightly jobs ──
  // Silence is judged against each job's OWN cadence, not a global clock. The
  // first version used one threshold for everything and reported 9 of 15 jobs
  // unhealthy on a green night: most of those are `once` MRF manifest jobs that
  // ran a single time, succeeded, and are finished. A monitor that cries about
  // completed work is one nobody reads, so:
  //
  //   - a job that has run once is a one-off — completed, never "overdue"
  //   - a job that has run twice or more has an observed gap between its last
  //     two runs; missing 2x that gap warns, 4x fails
  //   - the gap is floored at the daily cadence so a same-night retry pair does
  //     not set a 20-minute expectation
  //   - a run still in flight is in flight, not a failure
  const jobRows: JobRow[] = jobs.map((j) => {
    const lastRun = isoDateTime(j.started_at);
    const ageHours = hoursSince(lastRun);
    const prevRun = isoDateTime(j.prev_started_at);
    const observedGapHours =
      prevRun && lastRun ? (new Date(lastRun).getTime() - new Date(prevRun).getTime()) / 3_600_000 : null;
    const expected = Math.max(observedGapHours ?? THRESHOLDS.jobSilentWarnHours, THRESHOLDS.jobSilentWarnHours);

    let health: CheckStatus;
    if (j.status === "error") health = "failing";
    else if (j.status === "running") health = "healthy";
    else if (Number(j.runs) < 2 || ageHours === null) health = "healthy";
    else health = band(ageHours, expected * 2, expected * 4);
    // Silence never fails on its own — a weekly job on holiday is not an
    // outage. Only a reported error is.
    if (health === "failing" && j.status !== "error") health = "warning";

    return { job: j.job, status: j.status, lastRun, ageHours, durationMs: j.duration_ms, error: j.error, health };
  });
  const failedJobs = jobRows.filter((j) => j.health === "failing");
  checks.push({
    id: "nightly-jobs",
    label: "Nightly jobs",
    status: worst(...jobRows.map((j) => j.health)),
    value: `${jobRows.filter((j) => j.health === "healthy").length} of ${jobRows.length} healthy`,
    threshold: `an error fails; silence warns past ${THRESHOLDS.jobSilentWarnHours}h`,
    detail: failedJobs.length
      ? `${failedJobs.map((j) => j.job).join(", ")} reported an error on the last run.`
      : "Every job's most recent run reported success.",
    remediation:
      "Logs are under .harvest/runs/. The runner is the primary executor — the Vercel cron is manual/emergency only.",
    source: "sync_runs",
  });

  // ── transaction age ──
  const age = Number(txAge[0]?.age ?? 0);
  const ageStatus = band(age, THRESHOLDS.txAgeWarn, THRESHOLDS.txAgeFail);
  checks.push({
    id: "tx-age",
    label: "Transaction age",
    status: ageStatus,
    value: age.toLocaleString(),
    threshold: `warn at ${THRESHOLDS.txAgeWarn.toLocaleString()}, fail at ${THRESHOLDS.txAgeFail.toLocaleString()} (200M freeze horizon)`,
    detail: `The oldest unfrozen transaction id is ${age.toLocaleString()} transactions behind.`,
    remediation: "Autovacuum freezes these automatically. Climbing toward the horizon means a vacuum is being blocked — look for a long-open transaction or an abandoned replication slot.",
    source: "pg_class.relfrozenxid",
  });

  // ── meters: only proportions with a real denominator ──────────────────────
  // A meter is a share of something with a cap. Database size has no cap we
  // know without the Neon API, so it is deliberately NOT a meter here.
  const meterState = (s: CheckStatus) => (s === "failing" ? "depleted" : s === "warning" ? "warning" : "healthy");
  const freshPct = matviews.length
    ? (matviews.filter((m) => m.status === "healthy").length / matviews.length) * 100
    : null;
  const jobPct = jobRows.length ? (jobRows.filter((j) => j.health === "healthy").length / jobRows.length) * 100 : null;

  const meters: MonitorMeter[] = [
    {
      id: "cache",
      label: "Cache hit ratio",
      pct: hitPct,
      state: meterState(cacheStatus),
      primary: hitPct === null ? "—" : pct(hitPct),
      secondary: "Share of block reads served from memory · pg_stat_database",
    },
    {
      id: "connections",
      label: "Connections in use",
      pct: maxConn ? connPct : null,
      state: meterState(connStatus),
      primary: `${used} of ${maxConn}`,
      secondary: "Open sessions against max_connections · pg_stat_activity",
    },
    {
      id: "matviews",
      label: "Views within cadence",
      pct: freshPct,
      state: meterState(worst(...matviews.map((m) => m.status))),
      primary: `${matviews.filter((m) => m.status === "healthy").length} of ${matviews.length}`,
      secondary: "Rebuilt inside the nightly window · sync_runs",
    },
    {
      id: "jobs",
      label: "Jobs reporting healthy",
      pct: jobPct,
      state: meterState(worst(...jobRows.map((j) => j.health))),
      primary: `${jobRows.filter((j) => j.health === "healthy").length} of ${jobRows.length}`,
      secondary: "Most recent run per job · sync_runs",
    },
  ];

  return {
    available: true,
    generatedAt: new Date().toISOString(),
    checks,
    meters,
    matviews,
    jobs: jobRows,
    tables: dead.map((t) => ({
      name: t.relname,
      rows: t.live,
      size: t.size,
      deadPct: t.live > 0 ? (t.dead / t.live) * 100 : null,
    })),
    unusedIndexes: idx.map((i) => ({ table: i.relname, index: i.indexrelname, size: i.size })),
    longQueries: long.map((l) => ({
      pid: l.pid,
      seconds: l.seconds,
      state: l.state,
      query: l.query,
      maintenance: MAINTENANCE.test(l.query),
    })),
    databaseSize: size[0]?.size ?? null,
    neon: neonStatus(),
  };
}

/**
 * The Neon control plane — compute hours, storage, branch state, autosuspend —
 * needs an API key that does not exist yet. The `neon`-prefixed variables that
 * do exist are connection strings from the Vercel integration, not API access.
 * This returns the honest state rather than letting a panel invent numbers.
 */
export function neonStatus(): { configured: boolean; reason: string } {
  return process.env.NEON_API_KEY
    ? { configured: true, reason: "" }
    : {
        configured: false,
        reason:
          "NEON_API_KEY is not set. Compute hours, storage and branch state come from Neon's control plane, which the connection string cannot reach.",
      };
}

/** How long the same alert stays suppressed after being raised. A standing
 *  warning must not re-ring the bell every night — that is how a notification
 *  surface becomes wallpaper and stops being read. */
export const ALERT_REPEAT_HOURS = 20;

/**
 * Turn threshold crossings into notifications (sql/038 — the TopBar bell).
 *
 * This is the producer the bell has been missing. Part 1 of this tranche found
 * that no autonomous writer had ever produced a row: the seed script had, the
 * demoted cron route could not, and the harvest runner only writes when a job
 * FAILS. A healthy pipeline therefore meant a permanently empty bell.
 *
 * Every alert states the measured value and the threshold it crossed — a bare
 * "something is wrong" is not an alert, it is an interruption.
 *
 * Returns what it wrote and what it suppressed so a caller can log both.
 */
export async function raiseMonitorAlerts(
  snapshot: MonitorSnapshot,
): Promise<{ written: string[]; suppressed: string[] }> {
  const written: string[] = [];
  const suppressed: string[] = [];
  if (!hasDb || !snapshot.available) return { written, suppressed };

  const crossing = snapshot.checks.filter((c) => c.status === "failing" || c.status === "warning");
  if (!crossing.length) return { written, suppressed };

  const recent = (await sql`
    SELECT DISTINCT title FROM notifications
     WHERE kind = 'monitor_alert'
       AND created_at > now() - (${String(ALERT_REPEAT_HOURS)} || ' hours')::interval
  `) as Array<{ title: string }>;
  const alreadyRaised = new Set(recent.map((r) => r.title));

  for (const c of crossing) {
    const title = `${c.status === "failing" ? "Failing" : "Needs attention"}: ${c.label} — ${c.value}`;
    if (alreadyRaised.has(title)) {
      suppressed.push(title);
      continue;
    }
    await sql`
      INSERT INTO notifications (user_id, kind, title, body, href)
      SELECT id, 'monitor_alert', ${title}, ${`Threshold: ${c.threshold}. ${c.detail}`}, '/monitor'
        FROM users WHERE role = 'admin'
    `;
    written.push(title);
  }
  return { written, suppressed };
}

/** Checks that are not green, worst first — what the bell and the header count. */
export function attention(snapshot: MonitorSnapshot): MonitorCheck[] {
  const rank: Record<CheckStatus, number> = { failing: 0, warning: 1, unknown: 2, healthy: 3 };
  return snapshot.checks.filter((c) => c.status === "failing" || c.status === "warning").sort((a, b) => rank[a.status] - rank[b.status]);
}

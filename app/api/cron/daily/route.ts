import { NextResponse, type NextRequest } from "next/server";
import { hasDb, sql } from "@/lib/db";

// The nightly rebuild of everything the app derives rather than stores.
//
// The rate/participation surfaces (/rates, /directory, /orgs, /recruiting) read
// materialized views, not the 9M-row base tables — that precompute is the only
// reason /rates answers in under a second instead of 20-30. Nothing refreshes
// them on its own: until now they were rebuilt by hand after an ingest, which
// means that between ingests the numbers quietly aged. This is that routine,
// scheduled.
//
// EVERY REFRESH IS CONCURRENTLY, AND THAT IS NOT AN OPTIMISATION. A plain
// REFRESH takes an ACCESS EXCLUSIVE lock on the view for the whole rebuild — on
// a live app that is /rates hanging for the duration. CONCURRENTLY builds
// alongside and swaps, so readers never block. It costs more wall-clock and
// requires a UNIQUE index on the view; all ten have one (see each sql/0XX
// file), so this is available everywhere and there is no reason to take the
// lock. It also cannot run inside a transaction block — hence one statement per
// call, never a batch.
//
// ORDER MATTERS IN EXACTLY ONE PLACE: rate_table_mv (sql/027) joins
// org_tin_rosters (sql/025), so the roster is rebuilt first. Everything else
// reads only base tables and could run in any order — they run sequentially
// anyway, because the point is to be gentle with a database the app is still
// serving from.
//
// A FAILING STEP DOES NOT STOP THE RUN. The views are independent; one that
// errors keeps its previous contents, which is the same staleness the app
// already tolerates between refreshes — so the remaining nine should still get
// their night. The run is marked 'error' and the failure recorded per-step.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// MEASURED, not guessed — 2026-07-17, against the live book (9.34M rate rows,
// 2.4M participation rows): all ten refreshes + four ANALYZEs run ~190s end to
// end. That fits one function under Vercel's 300s cap with ~110s to spare, so
// this is a single route rather than the daily-1/daily-2 split the brief
// allowed for. The margin is the thing to watch: the chain scales with
// provider_rate_signals, so if that table roughly doubles this wants splitting
// at the org_tin_rosters boundary (everything above it is independent).
// Per-step timings are in the report, and every run records its own in
// sync_runs — so the split becomes a decision made on data, not a guess.
export const maxDuration = 300;

/** Refreshed here, in dependency order — the one that matters is
 *  org_tin_rosters BEFORE rate_table_mv (027 joins it). Identifiers, so never
 *  parameterisable: they are compile-time constants, and IDENT below is the
 *  belt to that brace. Measured seconds are this file's only claim to knowing
 *  what it costs. */
const VIEWS = [
  "provider_rate_summary", // 021 — /directory + /recruiting rate column   40.4s
  "provider_participation_summary", // 023 — accepting/network sort         8.5s
  "rate_bands_license_summary", // 024 — /rates bands                      19.5s
  "rate_bands_payer_summary", // 024                                       12.3s
  "rate_bands_checked_payers", // 024                                      13.8s
  "payer_rate_totals", // 026                                              14.4s
  "org_tin_rate_summary", // 025                                           25.6s
  "org_tin_rosters", // 025 — MUST precede rate_table_mv                    8.8s
  "rate_table_mv", // 027 — joins org_tin_rosters                          29.4s
  "rate_table_child_mv", // 032 — needs sql/036's index to go concurrent   11.6s
] as const;

/** ANALYZE, not VACUUM: the planner needs current statistics over tables that
 *  grow by millions of rows an ingest, and a stale n_distinct on
 *  provider_rate_signals is how a rates query goes from 0.3s back to 30s
 *  (NYS-52). VACUUM is autovacuum's job and a far heavier thing to schedule.
 *  All four together measured 5.7s — the cheapest insurance here. */
const ANALYZE_TABLES = [
  "provider_rate_signals",
  "provider_network_participation",
  "nppes_npi",
  "directory_providers",
] as const;

const IDENT = /^[a-z_][a-z0-9_]*$/;

export interface SyncStep {
  step: string;
  ms: number;
  rows?: number;
  error?: string;
}

/** Rebuild one view and count what it now holds. Never throws — a step's
 *  failure is data about the run, not the end of it. */
export async function refreshView(view: string): Promise<SyncStep> {
  const started = Date.now();
  if (!IDENT.test(view)) return { step: view, ms: 0, error: "refused: not a bare identifier" };
  try {
    await sql.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`, []);
    const [{ n }] = (await sql.query(`SELECT count(*)::int AS n FROM ${view}`, [])) as Array<{ n: number }>;
    return { step: view, ms: Date.now() - started, rows: n };
  } catch (e) {
    return { step: view, ms: Date.now() - started, error: String((e as Error).message ?? e).slice(0, 500) };
  }
}

export async function analyzeTable(table: string): Promise<SyncStep> {
  const started = Date.now();
  if (!IDENT.test(table)) return { step: `analyze ${table}`, ms: 0, error: "refused: not a bare identifier" };
  try {
    await sql.query(`ANALYZE ${table}`, []);
    return { step: `analyze ${table}`, ms: Date.now() - started };
  } catch (e) {
    return { step: `analyze ${table}`, ms: Date.now() - started, error: String((e as Error).message ?? e).slice(0, 500) };
  }
}

/**
 * Guard. Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the env var
 * is set, so the same check serves the scheduler and a human with the secret.
 *
 * An unset CRON_SECRET is a CLOSED door, not an open one: this endpoint spends
 * real database time, so the failure mode of a missing secret must be "nobody
 * can run it", never "anybody can".
 */
export function authorize(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set on this deployment." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}

/** Open the sync_runs row. Returns null if the log itself is unavailable — the
 *  refresh is worth doing even when we can't write down that we did it. */
export async function openRun(job: string, trigger: "cron" | "manual"): Promise<string | null> {
  try {
    const [{ id }] = (await sql`
      INSERT INTO sync_runs (job, trigger) VALUES (${job}, ${trigger}) RETURNING id
    `) as Array<{ id: string }>;
    return id;
  } catch {
    return null;
  }
}

export async function closeRun(id: string | null, steps: SyncStep[], startedAt: number): Promise<void> {
  if (!id) return;
  const failed = steps.filter((s) => s.error);
  try {
    await sql`
      UPDATE sync_runs
         SET finished_at = now(),
             duration_ms = ${Date.now() - startedAt},
             status      = ${failed.length ? "error" : "ok"},
             steps       = ${JSON.stringify(steps)}::jsonb,
             error       = ${failed.length ? failed.map((s) => `${s.step}: ${s.error}`).join(" | ").slice(0, 2000) : null}
       WHERE id = ${id}
    `;
  } catch {
    /* the log is a convenience, not the job */
  }
}

export function isCron(req: NextRequest): "cron" | "manual" {
  return req.headers.get("user-agent")?.startsWith("vercel-cron/") ? "cron" : "manual";
}

/** GET /api/cron/daily — the whole chain: ten refreshes, then ANALYZE. */
export async function GET(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;
  if (!hasDb) return NextResponse.json({ error: "No database attached." }, { status: 503 });

  const startedAt = Date.now();
  const runId = await openRun("daily", isCron(req));
  const steps: SyncStep[] = [];

  for (const v of VIEWS) steps.push(await refreshView(v));
  for (const t of ANALYZE_TABLES) steps.push(await analyzeTable(t));

  await closeRun(runId, steps, startedAt);
  const failed = steps.filter((s) => s.error);
  // 500 on any failed step so a Vercel cron failure is visible as one, rather
  // than a green tick over a chain that half-ran.
  return NextResponse.json(
    { job: "daily", runId, ms: Date.now() - startedAt, ok: failed.length === 0, steps },
    { status: failed.length ? 500 : 200 },
  );
}

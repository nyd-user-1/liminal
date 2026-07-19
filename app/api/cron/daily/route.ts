import { NextResponse, type NextRequest } from "next/server";
import { hasDb, sql } from "@/lib/db";
import { sendOpsAlertEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/repos/notifications";
// The rebuild plan (VIEWS/ANALYZE_TABLES, in dependency order) lives in ONE
// place so this route and the harvestd runner can never drift — see the header
// of ops/harvest/sync-plan.mjs for why the order matters and why every REFRESH
// is CONCURRENTLY. Adding a matview means editing that file, not this one.
import { VIEWS, ANALYZE_TABLES, IDENT } from "@/ops/harvest/sync-plan.mjs";

// The manual/emergency rebuild of everything the app derives rather than stores
// (/rates, /directory, /orgs, /recruiting read materialized views, not the
// 13M-row base tables — that precompute is the only reason /rates answers in
// under a second instead of 20-30).
//
// DEMOTED TO MANUAL-ONLY (NYS-130). This route is no longer scheduled. Two
// facts killed the Vercel cron: Hobby delivery is best-effort and silently
// skipped its window (the 2026-07-18 incident, proven by Neon's compute log),
// and — even when manually delivered that same day — the full chain was
// guillotined at exactly 300s, because at 13.4M rate rows it no longer fits one
// function under maxDuration. The PRIMARY nightly executor is now the harvestd
// runner (ops/harvest/runner.mjs), which runs this same chain via psql after
// the night's loads, with no 300s ceiling. This endpoint survives as an
// authenticated manual trigger (Bearer CRON_SECRET) — useful for a targeted
// re-run, but it will still time out on the full chain at current scale, so for
// a guaranteed full rebuild use the runner (`ops/harvest/install.sh run`) or
// psql directly. If an automatic cloud-side belt is ever wanted again (e.g. a
// laptop-away week), split this at the org_tin_rosters boundary first.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  // The alert must reach a human, not just the ledger: /workspace shows red on
  // the next visit, but nothing guarantees a visit. Best-effort — a down email
  // provider must not turn a half-failed refresh into a fully-failed response.
  if (failed.length) {
    await sendOpsAlertEmail({
      subject: `Nightly sync failed — ${failed.length} of ${steps.length} steps`,
      intro: `The ${isCron(req)} run at ${new Date(startedAt).toISOString()} finished with errors. The failed views kept their previous contents.`,
      failures: failed.map((s) => ({ step: s.step, error: s.error ?? "unknown" })),
    });
    await notifyAdmins({
      kind: "sync_failure",
      title: `Nightly sync failed — ${failed.length} of ${steps.length} steps`,
      body: failed.map((s) => s.step).join(", "),
    }).catch(() => {});
  }
  // 500 on any failed step so a Vercel cron failure is visible as one, rather
  // than a green tick over a chain that half-ran.
  return NextResponse.json(
    { job: "daily", runId, ms: Date.now() - startedAt, ok: failed.length === 0, steps },
    { status: failed.length ? 500 : 200 },
  );
}

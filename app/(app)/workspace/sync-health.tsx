import { Badge, DotBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { SyncHealth, SyncRun } from "@/lib/repos/sync-runs";

// The machine-room gauge: is the nightly matview rebuild alive, and what did
// the harvest runner do last night? Red is reserved for "someone should act
// today" — a failed or silently-stopped nightly; amber covers the benign
// in-between states (first run pending, a run currently in flight).

const DOT: Record<SyncRun["state"], "success" | "danger" | "warning"> = {
  ok: "success",
  error: "danger",
  died: "danger",
  running: "warning",
};

const STATE_LABEL: Record<SyncRun["state"], string> = {
  ok: "Healthy",
  error: "Failed",
  died: "Died mid-run",
  running: "Running",
};

function runMeta(run: SyncRun): string {
  const parts = [formatDateTime(run.startedAt), run.trigger];
  if (run.durationMs !== null) parts.push(`${Math.round(run.durationMs / 1000)}s`);
  if (run.steps.length > 0)
    parts.push(`${run.steps.length} steps${run.failedSteps.length > 0 ? `, ${run.failedSteps.length} failed` : ""}`);
  return parts.join(" · ");
}

export function SyncHealthCard({ health }: { health: SyncHealth }) {
  const { nightly, nightlyStale, harvests } = health;
  const red = nightly !== null && (nightly.state === "error" || nightly.state === "died" || nightlyStale);

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <DotBadge variant={nightly === null ? "warning" : red ? "danger" : DOT[nightly.state]} />
        <h3 className="text-[15px] font-semibold text-text">Nightly sync</h3>
        {nightly !== null && (
          <Badge variant={red ? "danger" : nightly.state === "running" ? "warning" : "success"}>
            {nightlyStale && nightly.state === "ok" ? "Stopped" : STATE_LABEL[nightly.state]}
          </Badge>
        )}
        {nightly !== null && <span className="text-sm text-text-muted">{runMeta(nightly)}</span>}
      </div>

      {nightly === null && (
        <Banner variant="warning">No runs recorded yet — the cron fires daily at 4:12 AM ET.</Banner>
      )}

      {nightly !== null && nightlyStale && (
        <Banner variant="danger">
          The nightly rebuild hasn&apos;t run in over 26 hours — the rate and directory surfaces are aging. Check the
          Vercel cron and <code className="text-[13px]">CRON_SECRET</code>.
        </Banner>
      )}

      {nightly !== null && (nightly.state === "error" || nightly.state === "died") && (
        <Banner variant="danger">
          {nightly.state === "died"
            ? "The last run opened but never closed — the function likely hit its time cap."
            : `Last run failed: ${nightly.failedSteps.map((s) => s.step).join(", ") || nightly.error || "unknown step"}.`}
        </Banner>
      )}

      {nightly !== null && nightly.failedSteps.length > 0 && (
        <div className="flex flex-col gap-1">
          {nightly.failedSteps.map((s) => (
            <div key={s.step} className="flex min-w-0 items-baseline gap-2 text-sm">
              <span className="font-medium text-danger">{s.step}</span>
              <span className="min-w-0 truncate text-text-muted">{s.error}</span>
            </div>
          ))}
        </div>
      )}

      {harvests.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Harvest runs</span>
          {harvests.map((h) => (
            <div key={h.id} className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
              <DotBadge variant={DOT[h.state]} />
              <span className="font-medium text-text">{h.job.replace(/^harvest:/, "")}</span>
              <span className="min-w-0 truncate text-text-muted">{runMeta(h)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

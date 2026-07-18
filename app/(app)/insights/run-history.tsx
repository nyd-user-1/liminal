"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { formatDateTime } from "@/lib/format";
import type { SyncRun } from "@/lib/repos/sync-runs";

// The run ledger, in full, under the sync-health gauge (see sync-health.tsx).
// The card answers "is the nightly alive right now?" with one line per job;
// this table is the history behind it — every recorded run, newest first, so a
// failure that already healed still leaves a visible trail. Health is judged in
// the repo (SyncRun.state), so the same word means the same thing in both.

// Same variant mapping as the card's DOT map — "died"/"error" both read danger.
// Labels are per-run here ("OK"/"Error"), not the card's health verbs
// ("Healthy"/"Stopped"), which describe the nightly's standing rather than one run.
const STATUS: Record<SyncRun["state"], { variant: "success" | "danger" | "warning"; label: string }> = {
  ok: { variant: "success", label: "OK" },
  error: { variant: "danger", label: "Error" },
  died: { variant: "danger", label: "Died" },
  running: { variant: "warning", label: "Running" },
};

function stepsSummary(run: SyncRun): string {
  if (run.steps.length === 0) return "—";
  const failed = run.failedSteps.length;
  return `${run.steps.length} steps${failed > 0 ? ` · ${failed} failed` : ""}`;
}

const columns: DataTableColumn<SyncRun>[] = [
  {
    key: "job",
    label: "Job",
    fixed: true,
    sortValue: (r) => r.job,
    render: (r) => <span className="font-medium text-text">{r.job}</span>,
  },
  {
    key: "status",
    label: "Status",
    render: (r) => <Badge variant={STATUS[r.state].variant}>{STATUS[r.state].label}</Badge>,
  },
  {
    key: "trigger",
    label: "Trigger",
    render: (r) => <span className="text-text-body">{r.trigger || "—"}</span>,
  },
  {
    key: "started",
    label: "Started",
    sortValue: (r) => r.startedAt,
    render: (r) => <span className="text-text-body">{formatDateTime(r.startedAt)}</span>,
  },
  {
    key: "duration",
    label: "Duration",
    align: "right",
    sortValue: (r) => r.durationMs ?? -1,
    render: (r) => (r.durationMs === null ? "—" : `${Math.round(r.durationMs / 1000)}s`),
  },
  {
    key: "steps",
    label: "Steps",
    render: (r) => <span className="text-text-muted">{stepsSummary(r)}</span>,
  },
];

export function RunHistory({ runs }: { runs: SyncRun[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Run history</span>
      <DataTable
        columns={columns}
        rows={runs}
        rowKey={(r) => r.id}
        defaultSort={{ col: "started", dir: "desc" }}
        stacked
      />
    </div>
  );
}

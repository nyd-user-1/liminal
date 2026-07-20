"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import type { SyncRun } from "@/lib/repos/sync-runs";
import { jobDescription } from "./job-descriptions";

// The run ledger, in full. The Sync-health card that used to sit above this is
// gone (TABLE STANDARD v2): the nightly's health now rides in the Harvest-runs
// title block, and each ledger table names itself and stamps its own source +
// freshness. Health is judged in the repo (SyncRun.state), so the same word
// means the same thing in the pill, the badge and the card it replaced.

// Same variant mapping as the card's DOT map — "died"/"error" both read danger.
// Labels are per-run here ("OK"/"Error"), not the card's health verbs
// ("Healthy"/"Stopped"), which describe the nightly's standing rather than one run.
const STATUS: Record<SyncRun["state"], { variant: "success" | "danger" | "warning"; label: string }> = {
  ok: { variant: "success", label: "OK" },
  error: { variant: "danger", label: "Error" },
  died: { variant: "danger", label: "Died" },
  running: { variant: "warning", label: "Running" },
};

// Sort weight so "Status" ascending surfaces the runs that need a human first.
const STATUS_WEIGHT: Record<SyncRun["state"], number> = { error: 0, died: 1, running: 2, ok: 3 };

function stepsSummary(run: SyncRun): string {
  if (run.steps.length === 0) return "—";
  const failed = run.failedSteps.length;
  return `${run.steps.length} steps${failed > 0 ? ` · ${failed} failed` : ""}`;
}

/** Column set shared by the Harvest-runs and History-logs tables — same ledger,
 *  same shape, so the two never read as two different tables. Every column is
 *  sortable (TABLE STANDARD v2): text A→Z, dates/durations/counts numeric, the
 *  Status column by "needs attention" weight. */
export const runColumns: DataTableColumn<SyncRun>[] = [
  {
    key: "job",
    label: "Job",
    fixed: true,
    sortValue: (r) => r.job,
    render: (r) => <span className="font-medium text-text">{r.job}</span>,
  },
  {
    key: "description",
    label: "Description",
    cellClassName: "max-w-xs truncate",
    sortValue: (r) => jobDescription(r.job),
    render: (r) => (
      <span className="text-text-muted" title={jobDescription(r.job)}>
        {jobDescription(r.job)}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortValue: (r) => STATUS_WEIGHT[r.state],
    render: (r) => <Badge variant={STATUS[r.state].variant}>{STATUS[r.state].label}</Badge>,
  },
  {
    key: "trigger",
    label: "Trigger",
    sortValue: (r) => r.trigger,
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
    sortValue: (r) => r.steps.length,
    render: (r) => <span className="text-text-muted">{stepsSummary(r)}</span>,
  },
];

const CSV_HEADERS = ["Job", "Description", "Status", "Trigger", "Started", "Duration (s)", "Steps", "Failed steps"];
const csvRow = (r: SyncRun): Array<string | number> => [
  r.job,
  jobDescription(r.job),
  STATUS[r.state].label,
  r.trigger,
  r.startedAt,
  r.durationMs == null ? "" : Math.round(r.durationMs / 1000),
  r.steps.length,
  r.failedSteps.length,
];

const copy = (text: string) => void navigator.clipboard?.writeText(text);

/** Per-row actions: a run has no external page to open, so the kebab is the
 *  copy-out surface — the id for a Neon lookup, the job name, the whole row. */
function RunKebab({ run }: { run: SyncRun }) {
  return (
    <KebabMenu label="Run actions">
      <MenuItem icon="copy" label="Copy run ID" onClick={() => copy(run.id)} />
      <MenuItem icon="copy" label="Copy job name" onClick={() => copy(run.job)} />
      <MenuItem icon="clipboard" label="Copy row" onClick={() => copy(csvRow(run).join("\t"))} />
    </KebabMenu>
  );
}

/** The ledger as a v2 stacked table — a search on the right, sortable columns,
 *  a per-row kebab, CSV export, and the honest source + freshness footer. Both
 *  the Harvest-runs and History-logs tabs are this component with different rows. */
export function RunsTable({
  rows,
  title,
  status,
  titleMeta,
  source,
  updatedAt,
  onRowClick,
  searchPlaceholder = "Search runs",
  exportName,
}: {
  rows: SyncRun[];
  title: ReactNode;
  status?: { variant: "neutral" | "success" | "warning" | "danger" | "info" | "blue"; label: string };
  titleMeta?: ReactNode;
  source: ReactNode;
  updatedAt: ReactNode;
  onRowClick?: (run: SyncRun) => void;
  searchPlaceholder?: string;
  exportName: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      `${r.job} ${jobDescription(r.job)} ${r.trigger} ${STATUS[r.state].label}`.toLowerCase().includes(s),
    );
  }, [rows, q]);

  return (
    <DataTable
      columns={runColumns}
      rows={filtered}
      rowKey={(r) => r.id}
      defaultSort={{ col: "started", dir: "desc" }}
      onRowClick={onRowClick}
      stacked
      fillHeight
      collapseActions
      title={title}
      status={status}
      titleMeta={titleMeta}
      source={source}
      updatedAt={
        <>
          {updatedAt}
          {q.trim() && ` · ${filtered.length} match${filtered.length === 1 ? "" : "es"}`}
        </>
      }
      onExport={() => downloadCsv(exportName, CSV_HEADERS, filtered.map(csvRow))}
      rowActions={(r) => <RunKebab run={r} />}
      toolbarLeft={
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full sm:w-60"
        />
      }
    />
  );
}

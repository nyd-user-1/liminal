"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import { ASOF, BACKLOG, type BacklogIssue, type Priority } from "@/lib/linear-backlog";

// Layer 1, row two — the Linear board snapshot as a plain table: In Progress
// first, then the backlog by priority. One row per issue, sortable, newest
// snapshot date in the sub-line. No pins, no marquee — just the board.

const PRIORITY_VARIANT: Record<Priority, "danger" | "warning" | "info" | "neutral"> = {
  Urgent: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
  None: "neutral",
};

// Sort weight so "Status" sorts In Progress → Urgent → … → None.
const STATUS_WEIGHT: Record<string, number> = { "In Progress": 0, Urgent: 1, High: 2, Medium: 3, Low: 4, None: 5 };

const columns: DataTableColumn<BacklogIssue>[] = [
  {
    key: "id",
    label: "Issue",
    fixed: true,
    sortValue: (r) => Number(r.id.replace(/^NYS-/, "").match(/^\d+/)?.[0] ?? 0),
    render: (r) => <span className="font-mono text-[12px] tracking-wide text-text-muted">{r.id}</span>,
  },
  {
    key: "title",
    label: "Title",
    cellClassName: "max-w-md truncate",
    sortValue: (r) => r.title,
    render: (r) => <span className="text-text">{r.title}</span>,
  },
  {
    key: "status",
    label: "Status",
    sortValue: (r) => STATUS_WEIGHT[r.status === "In Progress" ? "In Progress" : r.priority] ?? 9,
    render: (r) =>
      r.status === "In Progress" ? (
        <Badge variant="success">In progress</Badge>
      ) : (
        <Badge variant={PRIORITY_VARIANT[r.priority]}>{r.priority}</Badge>
      ),
  },
  {
    key: "created",
    label: "Created",
    align: "right",
    sortValue: (r) => r.created,
    render: (r) => <span className="tabular-nums text-text-body">{formatDate(`${r.created}T12:00:00`)}</span>,
  },
];

export function WorkQueue() {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-text">Work queue</h3>
        <span className="text-[12px] text-text-muted">Board snapshot · {formatDate(`${ASOF}T12:00:00`)}</span>
      </div>
      <DataTable columns={columns} rows={BACKLOG} rowKey={(r) => r.id} stacked />
    </div>
  );
}

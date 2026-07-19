"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import type { ReportEntry } from "@/lib/repos/reports";
import { ReportSheet } from "./report-sheet";

// The fleet's shipped reports as a table (same DataTable as Run history), newest
// first. Clicking a row opens that report in the note editor's document window
// (read-only) — the founder reads a report the same way they read a note.

const columns: DataTableColumn<ReportEntry>[] = [
  {
    key: "title",
    label: "Report",
    fixed: true,
    sortValue: (r) => r.title,
    render: (r) => <span className="font-medium text-text">{r.title}</span>,
  },
  {
    key: "slug",
    label: "File",
    cellClassName: "max-w-xs truncate",
    render: (r) => <span className="font-mono text-[12px] text-text-muted">{r.slug}</span>,
  },
  {
    key: "date",
    label: "Date",
    align: "right",
    sortValue: (r) => r.date,
    render: (r) => <span className="tabular-nums text-text-body">{formatDate(`${r.date}T12:00:00`)}</span>,
  },
];

export function ReportsTable({ reports }: { reports: ReportEntry[] }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Latest reports</span>
      <DataTable
        columns={columns}
        rows={reports}
        rowKey={(r) => r.slug}
        defaultSort={{ col: "date", dir: "desc" }}
        onRowClick={(r) => setOpenSlug(r.slug)}
        stacked
      />
      {openSlug && <ReportSheet slug={openSlug} onClose={() => setOpenSlug(null)} />}
    </div>
  );
}

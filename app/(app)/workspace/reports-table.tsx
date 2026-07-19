"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import type { ReportEntry } from "@/lib/repos/reports";
import { DocSheet } from "./doc-sheet";

// The fleet's shipped reports as a table, newest first. Clicking a row opens the
// report in the note editor's document window (editable). A derived "Agent"
// column names who filed it.

// Known fleet agents, and slug overrides where the filename doesn't lead with
// the agent's name (e.g. a data-agent report slugged "uhc-census").
const AGENTS = ["lead", "data", "quality", "ui", "docs", "review", "security", "ops", "research", "qa"];
const OVERRIDES: Record<string, string> = {
  "uhc-census": "data",
  search: "quality",
  entities: "quality",
  belt: "ops",
  agents: "docs",
  "docs-linear": "docs",
  "data-quality": "quality",
  "data-quality-t2": "quality",
  "insights-redesign": "ui",
};

const cap = (s: string) => (s === "ui" || s === "qa" ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1));

/** The agent that filed a report, from its slug (YYYY-MM-DD-<rest>). */
function agentForReport(slug: string): string | null {
  const rest = slug.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  if (OVERRIDES[rest]) return cap(OVERRIDES[rest]);
  const seg = rest.split("-").find((s) => AGENTS.includes(s));
  return seg ? cap(seg) : null;
}

const columns: DataTableColumn<ReportEntry>[] = [
  {
    key: "title",
    label: "Report",
    fixed: true,
    sortValue: (r) => r.title,
    render: (r) => <span className="font-medium text-text">{r.title}</span>,
  },
  {
    key: "agent",
    label: "Agent",
    sortValue: (r) => agentForReport(r.slug) ?? "~",
    render: (r) => <span className="text-text-body">{agentForReport(r.slug) ?? "—"}</span>,
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
    <>
      <DataTable
        columns={columns}
        rows={reports}
        rowKey={(r) => r.slug}
        defaultSort={{ col: "date", dir: "desc" }}
        onRowClick={(r) => setOpenSlug(r.slug)}
        stacked
      />
      {openSlug && <DocSheet endpoint={`/api/reports/${openSlug}`} label="Report" onClose={() => setOpenSlug(null)} />}
    </>
  );
}

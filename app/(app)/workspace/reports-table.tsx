"use client";

import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import type { ReportEntry } from "@/lib/repos/reports";
import { DocSheet } from "./doc-sheet";

// The fleet's shipped reports as a table, newest first. Clicking a row opens the
// report in the note editor's document window (editable). A derived "Agent"
// column names who filed it. TABLE STANDARD v2: names itself, search on the
// right, every column sortable, a per-row kebab (open the file / copy its name),
// and a footer that stamps the source (docs/reports/*.md) + freshness.

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
    sortValue: (r) => r.slug,
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

const copy = (text: string) => void navigator.clipboard?.writeText(text);
const CSV_HEADERS = ["Report", "Agent", "File", "Date"];
const csvRow = (r: ReportEntry): Array<string | number> => [r.title, agentForReport(r.slug) ?? "", r.slug, r.date];

export function ReportsTable({ reports }: { reports: ReportEntry[] }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return reports;
    return reports.filter((r) => `${r.title} ${agentForReport(r.slug) ?? ""} ${r.slug}`.toLowerCase().includes(s));
  }, [reports, q]);

  return (
    <>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.slug}
        defaultSort={{ col: "date", dir: "desc" }}
        onRowClick={(r) => setOpenSlug(r.slug)}
        stacked
        fillHeight
        collapseActions
        title="Agent reports"
        status={{ variant: "info", label: `${reports.length} recent` }}
        source="docs/reports/*.md"
        updatedAt={
          <>
            {reports.length ? `Newest ${formatDate(`${reports[0].date}T12:00:00`)}` : "no reports"}
            {q.trim() && ` · ${filtered.length} match${filtered.length === 1 ? "" : "es"}`}
          </>
        }
        onExport={() => downloadCsv("agent-reports", CSV_HEADERS, filtered.map(csvRow))}
        rowActions={(r) => (
          <KebabMenu label="Report actions">
            <MenuItem icon="file-text" label="Open report" onClick={() => setOpenSlug(r.slug)} />
            <MenuItem icon="copy" label="Copy file name" onClick={() => copy(`${r.slug}.md`)} />
          </KebabMenu>
        )}
        toolbarLeft={
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reports"
            className="w-full sm:w-60"
          />
        }
      />
      {openSlug && <DocSheet endpoint={`/api/reports/${openSlug}`} label="Report" onClose={() => setOpenSlug(null)} />}
    </>
  );
}

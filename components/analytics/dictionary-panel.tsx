"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { SidePanel } from "@/components/ui/side-panel";
import { TextLink } from "@/components/ui/text-link";
import type { MetricDef, MetricValue } from "@/lib/analytics/metrics";
import type { DictionaryEntry } from "@/lib/repos/analytics";

// The data dictionary — the other half of the SidePanel pairing (kicker "DATA
// DICTIONARY"). Opened from a card's source-table chip or its "About this data"
// kebab item.
//
// The prose is NOT written here: it's the curated registry in lib/repos/admin.ts
// that /admin/data and /dashboard already render. One description of a table,
// three surfaces.

type Row = { name: string; value: string };

export function DictionaryPanel({
  entryKey,
  entry,
  def,
  value,
  onClose,
}: {
  entryKey: string | null;
  entry: DictionaryEntry | undefined;
  def: MetricDef | undefined;
  /** When the metric is list-shaped, its rows become the top-10 table. */
  value: MetricValue | undefined;
  onClose: () => void;
}) {
  const open = !!entryKey && !!def;
  if (!open || !def) return null;

  const rows: Row[] = value?.kind === "ranking" ? value.rows.slice(0, 10).map((r) => ({ name: r.name, value: r.value })) : [];

  return (
    <SidePanel open={open} onClose={onClose} kicker="Data dictionary" title={def.sourceTable} icon="grid" width="max-w-lg">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-[15px] leading-relaxed text-text">{entry?.meaning ?? def.description}</p>
          {entry?.links && (
            <p className="text-sm text-text-muted">
              <span className="font-medium text-text">Joins: </span>
              {entry.links}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {entry?.count != null && <Badge variant="neutral">{entry.count.toLocaleString("en-US")} rows</Badge>}
          <Badge variant="info">{def.category}</Badge>
          {entry?.missing && <Badge variant="warning">Not yet loaded</Badge>}
        </div>

        {entry?.poweredPages && entry.poweredPages.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[9px] uppercase tracking-widest text-text-muted">Powers these pages</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {entry.poweredPages.map((p) => (
                <TextLink key={p.href} href={p.href} className="text-sm">
                  {p.label}
                </TextLink>
              ))}
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-[9px] uppercase tracking-widest text-text-muted">Top {rows.length} — {def.label}</p>
            <DataTable
              rows={rows}
              rowKey={(r) => r.name}
              columns={[
                { key: "name", label: "Name", fixed: true, render: (r) => r.name, cellClassName: "max-w-64 truncate" },
                { key: "value", label: "Value", align: "right", render: (r) => <span className="tabular-nums">{r.value}</span> },
              ]}
              rowActions={(r) => (
                <KebabMenu label={`Actions for ${r.name}`}>
                  <MenuItem icon="copy" label="Copy name" onClick={() => void navigator.clipboard.writeText(r.name)} />
                </KebabMenu>
              )}
              records={rows.length}
            />
          </div>
        )}

        <p className="text-[13px] text-text-muted">
          Full schema reference lives on the{" "}
          <TextLink href="/admin/data" className="text-[13px]">
            data dictionary
          </TextLink>
          .
        </p>
      </div>
    </SidePanel>
  );
}

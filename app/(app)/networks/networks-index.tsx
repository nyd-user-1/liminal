"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BulkAction, DataTable, EmptyCell, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import type { NetworkListRow } from "@/lib/repos/networks";

// The canonical-network index (sql/044, NYS-49) — the reference for the stacked
// full-feature DataTable (NYS-147): status tabs with counts above the card,
// per-column header menus (sort / filter / hide) with their toolbar chips,
// EmptyCell for every missing value, the select column feeding the floating
// bulk-action bar, plus the column picker, sortable headers, and real CSV
// export. 69 rows, so search / filter / sort are all client-side — no round trip.

const ADMIN_LABEL: Record<string, string> = {
  carelon: "Carelon",
  optum: "Optum",
  evernorth: "Evernorth",
  magnacare: "MagnaCare",
  multiplan: "MultiPlan",
  cigna: "Cigna",
  uhc: "UnitedHealth",
};

/** Display name for the administrator facet — the same string everywhere
 *  (cell, header-menu filter, CSV), so the filter matches what the eye sees. */
const adminLabel = (n: NetworkListRow) => (n.administrator ? (ADMIN_LABEL[n.administrator] ?? n.administrator) : "Insurer-run");

const csvFor = (list: NetworkListRow[]) => {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  return [
    ["Network", "Insurer", "Administrator", "Type", "Notes"].join(","),
    ...list.map((n) => [n.name, n.insurer, adminLabel(n), n.kind, n.notes ?? ""].map(esc).join(",")),
  ].join("\n");
};

export function NetworksIndex({ initial, orgsPriced = {} }: { initial: NetworkListRow[]; orgsPriced?: Record<string, number> }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Search first, kind tab second — the tab counts read off the SEARCHED set,
  // so each tab advertises exactly what clicking it will show.
  const searched = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return initial;
    return initial.filter(
      (n) =>
        n.name.toLowerCase().includes(term) ||
        n.insurer.toLowerCase().includes(term) ||
        adminLabel(n).toLowerCase().includes(term),
    );
  }, [initial, q]);
  const rows = useMemo(() => (tab === "all" ? searched : searched.filter((n) => n.kind === tab)), [searched, tab]);

  const selectedRows = useMemo(() => initial.filter((n) => selected.has(n.id)), [initial, selected]);

  const downloadCsv = (name: string, list: NetworkListRow[]) => {
    const url = URL.createObjectURL(new Blob([csvFor(list)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${list.length} network${list.length === 1 ? "" : "s"} as CSV.`, "success");
  };

  const columns: DataTableColumn<NetworkListRow>[] = [
    {
      key: "name",
      label: "Network",
      fixed: true,
      sortValue: (n) => n.name,
      cellClassName: "max-w-[24rem]",
      render: (n) => (
        <span className="block truncate font-medium text-text" title={n.name}>
          {n.name}
        </span>
      ),
    },
    {
      key: "insurer",
      label: "Insurer",
      sortValue: (n) => n.insurer,
      filterValue: (n) => n.insurer,
      render: (n) => <span className="text-text-body">{n.insurer}</span>,
    },
    {
      key: "administrator",
      label: "Administrator",
      sortValue: (n) => adminLabel(n),
      filterValue: (n) => adminLabel(n),
      render: (n) =>
        n.administrator ? (
          <Badge variant="info">{adminLabel(n)}</Badge>
        ) : (
          <EmptyCell label="Insurer-run" title="No TPA — the insurer administers this network directly" />
        ),
    },
    {
      key: "kind",
      label: "Type",
      sortValue: (n) => n.kind,
      render: (n) => <span className="capitalize text-text-body">{n.kind}</span>,
    },
    {
      key: "orgs",
      label: "Orgs priced",
      headTitle: "Organizations with an attested 90837 rate resolving to this network (sql/048)",
      align: "right",
      sortValue: (n) => orgsPriced[n.id] ?? 0,
      render: (n) => {
        const c = orgsPriced[n.id];
        return c ? (
          <span className="tabular-nums text-text-body">{c.toLocaleString("en-US")}</span>
        ) : (
          <EmptyCell label="No rates" title="No attested rates resolve to this network yet" />
        );
      },
    },
    {
      key: "notes",
      label: "Notes",
      defaultHidden: true,
      cellClassName: "max-w-[28rem]",
      render: (n) =>
        n.notes ? (
          <span className="block truncate text-text-muted" title={n.notes}>
            {n.notes}
          </span>
        ) : (
          <EmptyCell label="No notes" />
        ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        slideActive
        className="mb-3 shrink-0"
        items={[
          { key: "all", label: "All", count: searched.length },
          { key: "network", label: "Networks", count: searched.filter((n) => n.kind === "network").length },
          { key: "product", label: "Products", count: searched.filter((n) => n.kind === "product").length },
        ]}
        active={tab}
        onChange={setTab}
      />
      <DataTable
        stacked
        columns={columns}
        rows={rows}
        rowKey={(n) => n.id}
        storageKey="networks.columns"
        defaultSort={{ col: "insurer", dir: "asc" }}
        groupBy={[{ key: "insurer", label: "Insurer", value: (n) => n.insurer }]}
        fillHeight
        className="min-h-0 flex-1"
        selected={selected}
        onSelectedChange={setSelected}
        bulkActions={
          <>
            <BulkAction icon="download" label="Export CSV" onClick={() => downloadCsv("networks-selected.csv", selectedRows)} />
            <BulkAction
              icon="copy"
              label="Copy names"
              onClick={() => {
                navigator.clipboard.writeText(selectedRows.map((n) => n.name).join("\n"));
                toast(`Copied ${selectedRows.length} network name${selectedRows.length === 1 ? "" : "s"}.`, "success");
              }}
            />
          </>
        }
        onExport={() => downloadCsv("networks.csv", rows)}
        onRefresh={() => toast("Networks refresh nightly with the entity layer.", "info")}
        rowActions={(n) => (
          <KebabMenu label={`Actions for ${n.name}`}>
            <MenuItem icon="activity" label="View rates for this network" onClick={() => toast("Network rate view is coming with Find-my-plan.", "info")} />
          </KebabMenu>
        )}
        toolbarLeft={
          <>
            <SearchInput
              aria-label="Search networks"
              placeholder="Search networks by name, insurer, or administrator"
              className="max-w-md flex-1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQ("");
              }}
            />
            {q && <TextLink onClick={() => setQ("")}>Reset</TextLink>}
          </>
        }
        footnote={
          rows.length === 0 ? (
            <div className="rounded-card border border-border bg-surface shadow-card">
              <EmptyState icon="globe" title="No networks" subtext="Try a broader search or another tab." />
            </div>
          ) : (
            <span className="text-sm text-text-muted">
              {initial.length} canonical networks · resolved from 1,133 raw payer networks
            </span>
          )
        }
      />
    </div>
  );
}

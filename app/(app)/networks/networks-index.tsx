"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import type { NetworkListRow } from "@/lib/repos/networks";

// The canonical-network index (sql/044, NYS-49) — the reference for the stacked
// full-feature DataTable: the WHOLE toolbar (search + filter + kebab + column
// picker) lives inside the card, AND it keeps the select column, the row-action
// column, sortable headers, and the column picker. 69 rows, so search / filter /
// sort are all client-side — no round trip.

const ADMIN_LABEL: Record<string, string> = {
  carelon: "Carelon",
  optum: "Optum",
  evernorth: "Evernorth",
  magnacare: "MagnaCare",
  multiplan: "MultiPlan",
  cigna: "Cigna",
  uhc: "UnitedHealth",
};

export function NetworksIndex({ initial }: { initial: NetworkListRow[] }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [insurer, setInsurer] = useState<string | undefined>();
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const insurerOptions = useMemo(
    () => [...new Set(initial.map((n) => n.insurer))].sort((a, b) => a.localeCompare(b)),
    [initial],
  );

  // Search + insurer first, the kind tab second — the tab counts read the
  // searched set, so each tab advertises exactly what clicking it will show.
  const searched = useMemo(() => {
    const term = q.trim().toLowerCase();
    return initial.filter((n) => {
      if (insurer && n.insurer !== insurer) return false;
      if (!term) return true;
      return (
        n.name.toLowerCase().includes(term) ||
        n.insurer.toLowerCase().includes(term) ||
        (n.administrator ?? "").toLowerCase().includes(term)
      );
    });
  }, [initial, q, insurer]);
  const rows = useMemo(() => (tab === "all" ? searched : searched.filter((n) => n.kind === tab)), [searched, tab]);

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
    { key: "insurer", label: "Insurer", sortValue: (n) => n.insurer, render: (n) => <span className="text-text-body">{n.insurer}</span> },
    {
      key: "administrator",
      label: "Administrator",
      sortValue: (n) => n.administrator ?? "",
      render: (n) =>
        n.administrator ? (
          <Badge variant="info">{ADMIN_LABEL[n.administrator] ?? n.administrator}</Badge>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "kind",
      label: "Type",
      sortValue: (n) => n.kind,
      render: (n) => <span className="capitalize text-text-body">{n.kind}</span>,
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
          <span className="text-text-muted">—</span>
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
        fillHeight
        className="min-h-0 flex-1"
        selected={selected}
        onSelectedChange={setSelected}
        onExport={() => toast("Export isn’t wired up yet.", "info")}
        onRefresh={() => toast("Networks refresh nightly with the entity layer.", "info")}
        filter={
          <NetworkFilter value={insurer} options={insurerOptions} onSelect={setInsurer} onClear={() => setInsurer(undefined)} />
        }
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
            {(q || insurer) && (
              <TextLink
                onClick={() => {
                  setQ("");
                  setInsurer(undefined);
                }}
              >
                Reset
              </TextLink>
            )}
          </>
        }
        records={initial.length}
        footnote={
          rows.length === 0 ? (
            <div className="rounded-card border border-border bg-surface shadow-card">
              <EmptyState icon="globe" title="No networks" subtext="Try a broader search or clear the filters." />
            </div>
          ) : undefined
        }
      />
    </div>
  );
}

function NetworkFilter({
  value,
  options,
  onSelect,
  onClear,
}: {
  value?: string;
  options: string[];
  onSelect: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const shown = term ? options.filter((o) => o.toLowerCase().includes(term.toLowerCase())) : options;
  return (
    <span className="relative">
      <FilterChip label="Insurer" value={value} icon="list-filter" onClick={() => setOpen((o) => !o)} onClear={onClear} />
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1.5 w-72 rounded-card border border-border bg-surface p-2 shadow-menu">
            <SearchInput value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Filter insurers…" className="mb-1.5 w-full" />
            <div className="max-h-64 overflow-y-auto">
              {shown.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    onSelect(o);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                    o === value ? "font-semibold text-primary" : "text-text"
                  }`}
                >
                  <span className="flex-1 truncate">{o}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </span>
  );
}

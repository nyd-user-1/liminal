"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { SearchInput } from "@/components/ui/search-input";
import { SortableHead, Table, Td, Tr, useSort } from "@/components/ui/table";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { IconName } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/icon-button";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Tabs } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { Toolbar } from "@/components/ui/toolbar";
import type { OrgListRow } from "@/lib/repos/orgs";

// Organizations index — same chrome as Clients/Directory/Rates: a tab bar, a
// search + filter-chip toolbar, and a sortable table. Tabs scope the list
// (All / Named); chips refine it by payer book and TIN kind. Everything
// re-queries /api/orgs; the row opens the org workspace.

type Tab = "all" | "named";
type Col = "org" | "npis" | "payers" | "seen";
const TYPE_OPTIONS = ["EIN", "Org NPI"] as const;

function href(tin: string) {
  return `/orgs/${encodeURIComponent(tin)}`;
}

// FilterChip + attached searchable popover — the same toolbar pattern the
// Directory and Clients indexes use, over the shared FilterChip primitive.
// Options render verbatim (payer labels like "CDPHP" must not be title-cased).
function ChipMenu({
  label,
  value,
  options,
  onSelect,
  onClear,
  icon,
}: {
  label: string;
  value?: string;
  options: readonly string[];
  onSelect: (v: string) => void;
  onClear: () => void;
  icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);
  const searchable = options.length > 6;
  const shown = searchable && term ? options.filter((o) => o.toLowerCase().includes(term.toLowerCase())) : options;
  return (
    <span ref={ref} className="relative">
      <FilterChip label={label} value={value} icon={icon} onClick={() => setOpen((o) => !o)} onClear={onClear} />
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-72 rounded-card border border-border bg-surface p-2 shadow-menu">
          {searchable && (
            <SearchInput
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}…`}
              className="mb-1.5 w-full"
            />
          )}
          <div className="max-h-64 overflow-y-auto">
            {shown.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onSelect(o);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                  o === value ? "font-semibold text-primary" : "text-text"
                }`}
              >
                <span className="flex-1 truncate">{o}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

export function OrgsIndex({ initial, payerOptions }: { initial: OrgListRow[]; payerOptions: string[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [payer, setPayer] = useState<string | undefined>();
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number] | undefined>();
  const [rows, setRows] = useState<OrgListRow[]>(initial);
  const [sort, toggleSort] = useSort<Col>({ col: "npis", dir: "desc" });
  const seq = useRef(0);
  const first = useRef(true);

  const load = useCallback(async () => {
    const s = ++seq.current;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (tab === "named") params.set("named", "1");
    if (payer) params.set("payer", payer);
    if (type) params.set("kind", type === "EIN" ? "ein" : "npi");
    try {
      const res = await fetch(`/api/orgs?${params.toString()}`);
      const data = await res.json();
      if (s === seq.current) setRows((data.orgs ?? []) as OrgListRow[]);
    } catch {
      if (s === seq.current) setRows([]);
    }
  }, [q, tab, payer, type]);

  // Re-query on any tab/search/filter change (debounced). Skip the very first
  // run — the server already seeded the default view.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(load, 220);
    return () => clearTimeout(t);
  }, [load]);

  function resetFilters() {
    setQ("");
    setPayer(undefined);
    setType(undefined);
  }
  const hasFilters = !!(q || payer || type);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toast = useToast();

  const sorted = sortRows(rows, sort.col, sort.dir);

  const columns: DataTableColumn<OrgListRow>[] = [
    {
      key: "org",
      label: "Organization",
      fixed: true,
      sortValue: (o) => o.name ?? o.label,
      cellClassName: "max-w-[28rem]",
      render: (o) =>
        o.name ? (
          <span className="block truncate font-medium text-text" title={o.name}>
            {o.name}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="font-medium tabular-nums text-text-body">{o.label}</span>
            <Badge variant="neutral" className="!font-normal">
              unnamed
            </Badge>
          </span>
        ),
    },
    {
      key: "npis",
      label: "Clinicians",
      sortValue: (o) => o.npis,
      render: (o) => <span className="tabular-nums font-medium text-text">{o.npis.toLocaleString()}</span>,
    },
    { key: "payers", label: "Payer books", sortValue: (o) => o.payerCount, render: (o) => <span className="tabular-nums text-text-body">{o.payerCount}</span> },
    { key: "seen", label: "Last seen", sortValue: (o) => o.lastFileDate ?? "", render: (o) => <span className="text-text-muted">{o.lastFileDate ?? "—"}</span> },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBarActions>
        <Button size="sm" leftIcon="plus" onClick={() => toast("New organization isn\u2019t wired up yet.", "info")}>
          New organization
        </Button>
        <IconButton icon="bell" label="Notifications" onClick={() => toast("No new notifications.", "info")} />
      </TopBarActions>

      <Tabs
        className="mt-4 mb-4 shrink-0"
        slideActive
        active={tab}
        onChange={(k) => (k === "registry" ? router.push("/orgs/registry") : setTab(k as Tab))}
        items={[
          { key: "all", label: "All" },
          { key: "named", label: "Named" },
          // The NPPES legal-org book (sql/034) — a sibling surface, own route.
          { key: "registry", label: "NPI-2 registry" },
        ]}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <DataTable
          columns={columns}
          rows={sorted}
          rowKey={(o) => o.tin}
          storageKey="orgs.columns"
          lazy
          fillHeight
          className="min-h-0 flex-1"
          onRowClick={(o) => router.push(href(o.tin))}
          selected={selected}
          onSelectedChange={setSelected}
          onExport={() => toast("Export isn\u2019t wired up yet.", "info")}
          onRefresh={() => load()}
          filter={
            <ChipMenu
              label="Filter"
              icon="list-filter"
              value={payer ?? type}
              options={[...payerOptions, ...TYPE_OPTIONS]}
              onSelect={(v) =>
                (TYPE_OPTIONS as readonly string[]).includes(v) ? setType(v as (typeof TYPE_OPTIONS)[number]) : setPayer(v)
              }
              onClear={() => {
                setPayer(undefined);
                setType(undefined);
              }}
            />
          }
          rowActions={(o) => (
            <KebabMenu label={`Actions for ${o.name ?? o.label}`}>
              <MenuItem icon="id-card" label="Open organization" onClick={() => router.push(href(o.tin))} />
            </KebabMenu>
          )}
          toolbarLeft={
            <>
              <SearchInput
                aria-label="Search organizations"
                placeholder="Search organizations by name"
                className="max-w-md flex-1"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQ("");
                  if (e.key === "Enter") load();
                }}
              />
              {hasFilters && <TextLink onClick={resetFilters}>Reset</TextLink>}
            </>
          }
          footnote={
            sorted.length === 0 ? (
              <div className="rounded-card border border-border bg-surface shadow-card">
                <EmptyState
                  icon="id-card"
                  title="No organizations"
                  subtext={hasFilters ? "Try a broader search or clear the filters." : "No organizations on file yet."}
                  actions={
                    hasFilters ? (
                      <Button variant="secondary" onClick={resetFilters}>
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}

function sortRows(rows: OrgListRow[], col: Col, dir: "asc" | "desc"): OrgListRow[] {
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (col === "org") cmp = (a.name ?? a.label).localeCompare(b.name ?? b.label);
    else if (col === "npis") cmp = a.npis - b.npis;
    else if (col === "payers") cmp = a.payerCount - b.payerCount;
    else if (col === "seen") cmp = (a.lastFileDate ?? "").localeCompare(b.lastFileDate ?? "");
    return cmp * m || b.npis - a.npis;
  });
}

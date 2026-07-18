"use client";

import { useMemo, useRef, useState } from "react";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { Badge } from "@/components/ui/badge";
import { BulkAction, DataTable, EmptyCell, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { RelatedLink } from "@/components/ui/text-link";
import { SearchInput } from "@/components/ui/search-input";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import type { NetworkListRow, NetworkRateStat, OrgNetworkRatesSummary } from "@/lib/repos/networks";
import { adminLabel, kindLabel } from "./labels";
import { NetworkIdentityCard } from "./network-card";

// The canonical-network index (sql/044, NYS-49) — the reference for the
// NYS-147/148 template: identity card (aggregate ⇄ row via the skeleton
// transition) → hairline → the stacked full-feature DataTable (hover header
// menus with sort/filter/hide, View options panel, EmptyCell, select column +
// floating bulk bar, paginated footer). 69 rows, so search / filter / sort are
// client-side — no round trip.

const csvFor = (list: NetworkListRow[]) => {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  return [
    ["Network", "Insurer", "Administrator", "Type", "Notes"].join(","),
    ...list.map((n) => [n.name, n.insurer, adminLabel(n), kindLabel(n), n.notes ?? ""].map(esc).join(",")),
  ].join("\n");
};

export function NetworksIndex({
  initial,
  orgsPriced = {},
  summary = null,
}: {
  initial: NetworkListRow[];
  orgsPriced?: Record<string, NetworkRateStat>;
  summary?: OrgNetworkRatesSummary | null;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // The card's focus: null = aggregate. Every swap passes through the
  // skeleton state so the card reads as re-filling in place.
  const [focus, setFocus] = useState<NetworkListRow | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const skeletonTimer = useRef<number | null>(null);
  const focusRow = (n: NetworkListRow | null) => {
    setFocus(n);
    setCardLoading(true);
    if (skeletonTimer.current !== null) window.clearTimeout(skeletonTimer.current);
    skeletonTimer.current = window.setTimeout(() => setCardLoading(false), 450);
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return initial;
    return initial.filter(
      (n) =>
        n.name.toLowerCase().includes(term) ||
        n.insurer.toLowerCase().includes(term) ||
        adminLabel(n).toLowerCase().includes(term),
    );
  }, [initial, q]);

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
      cellClassName: "max-w-[20rem]",
      render: (n) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <InsurerMark payer={n.insurer} />
          <RelatedLink href={`/insurers/${n.insurerId}`} title={`Open ${n.insurer}`}>
            <span className="truncate">{n.insurer}</span>
          </RelatedLink>
        </span>
      ),
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
      filterValue: (n) => kindLabel(n),
      render: (n) => <span className="text-text-body">{kindLabel(n)}</span>,
    },
    {
      key: "orgs",
      label: "Orgs priced",
      headTitle: "Organizations with an attested 90837 rate resolving to this network (sql/048)",
      align: "right",
      sortValue: (n) => orgsPriced[n.id]?.orgs ?? 0,
      render: (n) => {
        const c = orgsPriced[n.id]?.orgs;
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
      <NetworkIdentityCard
        focus={focus}
        loading={cardLoading}
        all={initial}
        orgStats={orgsPriced}
        summary={summary}
        onClear={() => focusRow(null)}
      />
      {/* The frame's hairline — the object-tab row (NYS-148) slots in above it. */}
      <div className="my-4 shrink-0 border-b border-border" />
      <DataTable
        stacked
        columns={columns}
        rows={rows}
        rowKey={(n) => n.id}
        storageKey="networks.columns"
        defaultSort={{ col: "insurer", dir: "asc" }}
        groupBy={[{ key: "insurer", label: "Insurer", value: (n) => n.insurer }]}
        paginate={{ pageSize: 15 }}
        fillHeight
        className="min-h-0 flex-1"
        selected={selected}
        onSelectedChange={setSelected}
        onRowClick={(n) => focusRow(focus?.id === n.id ? null : n)}
        rowClassName={(n) => (focus?.id === n.id ? "bg-primary-wash/40" : undefined)}
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
              <EmptyState icon="globe" title="No networks" subtext="Try a broader search or clear the filters." />
            </div>
          ) : undefined
        }
      />
    </div>
  );
}

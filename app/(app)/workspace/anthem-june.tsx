"use client";

import { useCallback, useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { downloadCsv } from "@/lib/csv";
import type { RawSignalRow } from "@/lib/repos/rate-signals";

// The "Anthem-June" tab (TASK-WORKSPACE-V4 T2) — the June Empire 39F0 load
// (476,114 rows) straight off provider_rate_signals, one row per stored fact.
// Column headers are the literal DB column names on purpose: this is a raw
// inspector, not a rate surface, so negotiated_rate shows the stored value.
//
// Server-paginated on the /rates Services pattern: /api/workspace/anthem-june
// returns a page + the full count; scrolling the bounded rows region advances the
// offset (onEndReached), and the count comes back once on page 0. Never ships 476k
// rows to the client.

const PAGE = 200;

type Result = { rows: RawSignalRow[]; total: number };

const truncCell = "max-w-[220px] truncate";

// Every column is sortable (TABLE STANDARD v2). This is a SERVER-paginated
// inspector, so a header sort orders the rows loaded so far (the current
// window), not the full 476k — the honest behaviour for a raw drill-down where
// the NPI filter is the real narrowing tool. negotiated_rate + file_date sort
// numeric/chronological; the rest sort as text.
const columns: DataTableColumn<RawSignalRow>[] = [
  { key: "npi", label: "npi", fixed: true, sortValue: (r) => r.npi, render: (r) => <span className="font-mono text-[13px] text-text">{r.npi}</span> },
  { key: "payer", label: "payer", cellClassName: "max-w-[180px] truncate", sortValue: (r) => r.payer, render: (r) => <span className="text-text-body" title={r.payer}>{r.payer}</span> },
  {
    key: "plan_or_network",
    label: "plan_or_network",
    cellClassName: truncCell,
    sortValue: (r) => r.planOrNetwork,
    render: (r) => <span className="text-text-body" title={r.planOrNetwork}>{r.planOrNetwork || "—"}</span>,
  },
  { key: "billing_code", label: "billing_code", sortValue: (r) => r.billingCode, render: (r) => <span className="font-mono text-[13px] text-text-body">{r.billingCode}</span> },
  {
    key: "negotiated_rate",
    label: "negotiated_rate",
    align: "right",
    sortValue: (r) => parseFloat(r.negotiatedRate) || 0,
    render: (r) => <span className="font-medium text-text">{r.negotiatedRate}</span>,
  },
  { key: "negotiated_type", label: "negotiated_type", sortValue: (r) => r.negotiatedType, render: (r) => <span className="text-text-muted">{r.negotiatedType || "—"}</span> },
  { key: "billing_class", label: "billing_class", sortValue: (r) => r.billingClass, render: (r) => <span className="text-text-muted">{r.billingClass || "—"}</span> },
  {
    key: "place_of_service",
    label: "place_of_service",
    cellClassName: "max-w-[160px] truncate",
    sortValue: (r) => r.placeOfService,
    render: (r) => <span className="font-mono text-[12px] text-text-muted" title={r.placeOfService}>{r.placeOfService || "—"}</span>,
  },
  { key: "tin", label: "tin", sortValue: (r) => r.tin, render: (r) => <span className="font-mono text-[12px] text-text-body">{r.tin}</span> },
  {
    key: "source_file",
    label: "source_file",
    cellClassName: "max-w-[200px] truncate",
    sortValue: (r) => r.sourceFile,
    render: (r) => <span className="font-mono text-[12px] text-text-muted" title={r.sourceFile}>{r.sourceFile}</span>,
  },
  { key: "file_date", label: "file_date", sortValue: (r) => r.fileDate, render: (r) => <span className="tabular-nums text-text-muted">{r.fileDate}</span> },
];

const copy = (text: string) => void navigator.clipboard?.writeText(text);
const CSV_HEADERS = [
  "npi", "payer", "plan_or_network", "billing_code", "negotiated_rate",
  "negotiated_type", "billing_class", "place_of_service", "tin", "source_file", "file_date",
];
const csvRow = (r: RawSignalRow): Array<string | number> => [
  r.npi, r.payer, r.planOrNetwork, r.billingCode, r.negotiatedRate,
  r.negotiatedType, r.billingClass, r.placeOfService, r.tin, r.sourceFile, r.fileDate,
];

export function AnthemJune() {
  const [npi, setNpi] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [more, setMore] = useState<RawSignalRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useCallback(
    (offset: number) => {
      const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (npi.trim()) p.set("npi", npi.trim());
      return p.toString();
    },
    [npi],
  );

  // Page 0 (debounced so typing an NPI doesn't fire per keystroke).
  useEffect(() => {
    let stale = false;
    setError(null);
    setSyncing(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/workspace/anthem-june?${params(0)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't load rows.");
        if (stale) return;
        setData(json);
        setMore([]);
      } catch (e) {
        if (!stale) setError(e instanceof Error ? e.message : "Couldn't load rows.");
      } finally {
        if (!stale) setSyncing(false);
      }
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [params]);

  const loaded = data ? [...data.rows, ...more] : [];

  const loadMore = async () => {
    if (busy || syncing || !data || loaded.length >= data.total) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workspace/anthem-june?${params(loaded.length)}`);
      const json = await res.json();
      if (res.ok) setMore((m) => [...m, ...json.rows]);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Banner variant="danger">{error}</Banner>;

  return (
    <DataTable
      columns={columns}
      rows={loaded}
      rowKey={(r) => `${r.npi}|${r.billingCode}|${r.planOrNetwork}|${r.negotiatedRate}|${r.placeOfService}|${r.tin}|${r.sourceFile}`}
      storageKey="workspace.anthemJune.columns"
      fillHeight
      stacked
      collapseActions
      title="Anthem-June"
      status={
        data
          ? { variant: "info", label: `${data.total.toLocaleString("en-US")} rows` }
          : { variant: "neutral", label: "Loading" }
      }
      source="provider_rate_signals · June Empire 39F0"
      updatedAt={
        data ? (
          <>
            <span className="tabular-nums">{loaded.length.toLocaleString("en-US")}</span> of{" "}
            <span className="tabular-nums">{data.total.toLocaleString("en-US")}</span> loaded
            {busy && <span className="ml-2">Loading more…</span>}
            {syncing && <span className="ml-2">Searching…</span>}
          </>
        ) : (
          "Loading rows…"
        )
      }
      onEndReached={loadMore}
      onExport={() => downloadCsv("anthem-june", CSV_HEADERS, loaded.map(csvRow))}
      rowActions={(r) => (
        <KebabMenu label="Row actions">
          <MenuItem icon="copy" label="Copy NPI" onClick={() => copy(r.npi)} />
          <MenuItem icon="clipboard" label="Copy row" onClick={() => copy(csvRow(r).join("\t"))} />
        </KebabMenu>
      )}
      toolbarLeft={
        <SearchInput
          value={npi}
          onChange={(e) => setNpi(e.target.value.replace(/\D/g, ""))}
          placeholder="Filter by NPI"
          inputMode="numeric"
          className="w-full sm:w-64"
        />
      }
      footnote={
        data && loaded.length === 0 && !syncing ? (
          <div className="rounded-card border border-border bg-surface shadow-card">
            <EmptyState icon="search" title="No rows for that NPI" subtext="Clear the filter to see all 476,114." />
          </div>
        ) : undefined
      }
    />
  );
}

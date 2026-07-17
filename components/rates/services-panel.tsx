"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterMenu } from "@/components/ui/filter-menu";
import { SearchInput } from "@/components/ui/search-input";
import { cptLabel } from "@/components/rates/cpt";
import { InsurerCell } from "@/components/rates/insurer-mark";
import { TextLink } from "@/components/ui/text-link";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import { networkLabel, settingLabel } from "@/lib/rate-table";
import { formatDate, providerDisplayName } from "@/lib/format";
import type { RateRow } from "@/lib/repos/rate-rows";

// Services — the rates themselves, one row per service, as the payer published
// it. This replaced a quartile table: 25/50/75 are a claim about a cohort, and
// they were being read as "the" rate. The bands are still worth having, so they
// live behind the Bands toggle (rates-shell owns that switch) — not deleted.
//
// SERVER-paginated: 425,687 service rows exist, so the page comes from
// /api/rates/services and "Load more" advances the offset. Nothing is filtered
// client-side — the facets and the search go to the query, or the count lies.
//
// The PLAN column is `network` (the payer's own product). There is no employer
// plan to show: `plans` is Aetna-only and this book excludes Aetna by design —
// see NYS-93. The old table read "All networks" on every row only because the
// bands aggregated this away.

const PAGE = 500;
const CODES = ["90791", "90834", "90837", "90853", "99214"] as const;

type Result = { rows: RateRow[]; total: number; facets: { payers: string[]; networks: string[] } };

export function ServicesPanel() {
  const [q, setQ] = useState("");
  const [payer, setPayer] = useState<string | undefined>();
  const [code, setCode] = useState<string | undefined>();
  const [network, setNetwork] = useState<string | undefined>();
  const [data, setData] = useState<Result | null>(null);
  const [more, setMore] = useState<RateRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useCallback(
    (offset: number) => {
      const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (q.trim()) p.set("q", q.trim());
      if (payer) p.set("payer", payer);
      if (code) p.set("code", code);
      if (network) p.set("network", network);
      return p.toString();
    },
    [q, payer, code, network],
  );

  // Debounced — every keystroke and facet change is a new query, so the count
  // and the rows always agree.
  useEffect(() => {
    let stale = false;
    setError(null);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/rates/services?${params(0)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't load rates.");
        if (stale) return;
        setData(json);
        setMore([]);
      } catch (e) {
        if (!stale) setError(e instanceof Error ? e.message : "Couldn't load rates.");
      }
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [params]);

  const rows = data ? [...data.rows, ...more] : [];

  // Grows the loaded set on scroll (no "Load more" button). Guarded so the
  // bottom sentinel can fire repeatedly without stacking fetches or running
  // past the total.
  const loadMore = async () => {
    if (busy || !data || rows.length >= data.total) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rates/services?${params(rows.length)}`);
      const json = await res.json();
      if (res.ok) setMore((m) => [...m, ...json.rows]);
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<RateRow>[] = [
    {
      key: "clinician",
      label: "Clinician",
      fixed: true,
      // Truncate on the inner BLOCK, not the <td>: a table cell ignores
      // max-width in auto-layout, so the column grows to the longest hospital
      // name and shoves the sticky header sideways. A capped block holds it.
      render: (r) => (
        <span className="block max-w-56 truncate font-medium text-text" title={r.displayName ?? r.npi}>
          {r.displayName ? providerDisplayName(r.displayName, "1") : `NPI ${r.npi}`}
        </span>
      ),
    },
    { key: "service", label: "Service", render: (r) => cptLabel(r.billingCode) },
    { key: "code", label: "Code", render: (r) => <span className="text-text-muted">{r.billingCode}</span> },
    { key: "insurer", label: "Insurer", render: (r) => <InsurerCell payer={r.payer} /> },
    {
      key: "plan",
      label: "Plan",
      headTitle: "The plan/network the insurer published this rate under — their product, not an employer's plan",
      render: (r) => <span className="block max-w-52 truncate" title={r.network}>{networkLabel(r.network, r.payer)}</span>,
    },
    {
      key: "setting",
      label: "Setting",
      headTitle: "Place of service — the same clinician can be priced differently in an office vs a facility",
      render: (r) => <span className="text-text-body" title={r.setting}>{settingLabel(r.setting) || "—"}</span>,
    },
    {
      key: "rate",
      label: "Rate In-Ntwk",
      align: "right",
      render: (r) =>
        r.rate != null ? (
          <span className="font-medium text-text">${r.rate.toFixed(2)}</span>
        ) : (
          // Not a missing rate — the payer published several for this exact
          // cell and we will not pick one for them (NYS-64).
          <span title={`The payer published ${r.nRates} different rates for this exact cell`}>
            <Badge variant="warning" className="!font-normal">{r.nRates} rates</Badge>
          </span>
        ),
    },
    {
      key: "asOf",
      label: "As-of",
      render: (r) => <span className="text-text-muted">{r.asOf ? formatDate(`${r.asOf}T00:00:00`) : "—"}</span>,
    },
  ];

  if (error) return <Banner variant="danger">{error}</Banner>;
  if (!data) return <TableSkeleton head={["Clinician", "Service", "Code", "Insurer", "Plan", "Setting", "Rate", "As-of"]} />;

  // One two-level Filter in place of three chips: the dimension first, its
  // values behind it — Insurer/Plan searchable (long facet lists), Code short.
  const filterCategories = [
    { key: "payer", label: "Insurer", options: data.facets.payers.map((p) => ({ value: p, label: p })) },
    { key: "network", label: "Plan", options: data.facets.networks.map((n) => ({ value: n, label: n })) },
    { key: "code", label: "Code", options: CODES.map((c) => ({ value: c, label: `${c} · ${cptLabel(c)}` })) },
  ];
  const filterSelected = { payer, network, code };
  const onFilterSelect = (key: string, value: string | undefined) => {
    if (key === "payer") setPayer(value);
    else if (key === "network") setNetwork(value);
    else if (key === "code") setCode(value);
  };

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => `${r.payer}|${r.tin}|${r.npi}|${r.network}|${r.setting}|${r.billingCode}`}
      storageKey="rates.services.columns"
      fillHeight
      stacked
      collapseActions
      className="min-h-0 flex-1"
      onExport={() => setError(null)}
      onEndReached={loadMore}
      toolbarLeft={
        // Search leads, then the one Filter. The utility cluster (Columns/Export)
        // folds into the kebab on the right (collapseActions).
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by clinician, insurer, plan, TIN or NPI"
            className="w-full sm:w-[447px]"
          />
          <FilterMenu categories={filterCategories} selected={filterSelected} onSelect={onFilterSelect} />
        </div>
      }
      footnote={
        rows.length === 0 ? (
          <div className="rounded-card border border-border bg-surface shadow-card">
            <EmptyState icon="clipboard" title="No published rates match" subtext="Clear the search or a filter." />
          </div>
        ) : undefined
      }
      tableFooter={
        <p className="text-[13px] text-text-muted">
          Search <span className="tabular-nums">{data.total.toLocaleString("en-US")}</span> published rates. For Billing
          groups with more than 100 published rate rows see the corresponding <TextLink href="/orgs">organization</TextLink>.
          {busy && <span className="ml-2">Loading…</span>}
        </p>
      }
    />
  );
}

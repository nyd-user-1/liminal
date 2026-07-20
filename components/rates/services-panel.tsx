"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterMenu } from "@/components/ui/filter-menu";
import { SearchInput } from "@/components/ui/search-input";
import { ALL_CPTS, cptLabel } from "@/components/rates/cpt";
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
// HYBRID SEARCH (TASK-SEARCH, founder directive): 425,687 service rows exist, so
// the corpus is server-paginated — the page comes from /api/rates/services and
// scroll advances the offset. But typing must feel INSTANT, so two layers run at
// once:
//   1. Client-side reduction — every keystroke immediately filters the rows
//      already loaded (the "sports feel": the visible list only shrinks, zero
//      round-trip). This is a SUBSET preview, honest about being one.
//   2. Debounced (150 ms) server query — the authoritative full-corpus match
//      (includes rows beyond the loaded page), which replaces the preview when it
//      lands. sql/060's trigram index + the two-query split in listRateRows put
//      that response at ~90–170 ms, so it slides in right under the instant one.
// Nothing ever blanks: the previous rows stay on screen (keep-previous) while the
// server catches up, and the footer says whether it's still searching.
//
// The PLAN column is `network` (the payer's own product). There is no employer
// plan to show: `plans` is Aetna-only and this book excludes Aetna by design —
// see NYS-93. The old table read "All networks" on every row only because the
// bands aggregated this away.

const PAGE = 500;
// Every priced code, not the five the old pivot could reach (NYS-50). This is a
// FILTER list, so twenty costs nothing in width — it costs one hardcoded array.
const CODES = ALL_CPTS.map((c) => c.code);

type Result = { rows: RateRow[]; total: number; facets: { payers: string[]; networks: string[] } };

/** The client-side mirror of the server ILIKE (display_name/payer/network/tin/npi).
 *  Applied to the already-loaded rows so a keystroke narrows them with no fetch. */
function clientMatch(r: RateRow, qn: string): boolean {
  return (
    (r.displayName ?? "").toLowerCase().includes(qn) ||
    r.payer.toLowerCase().includes(qn) ||
    (r.network ?? "").toLowerCase().includes(qn) ||
    r.tin.toLowerCase().includes(qn) ||
    r.npi.includes(qn)
  );
}

export function ServicesPanel() {
  const [q, setQ] = useState("");
  const [payer, setPayer] = useState<string | undefined>();
  const [code, setCode] = useState<string | undefined>();
  const [network, setNetwork] = useState<string | undefined>();
  const [data, setData] = useState<Result | null>(null);
  const [more, setMore] = useState<RateRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
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

  // Debounced — every keystroke and facet change is a new server query, so the
  // count and the authoritative rows always agree. `syncing` flips true the moment
  // the query params change (the client preview is showing a subset) and false
  // when the server's full-corpus answer lands.
  useEffect(() => {
    let stale = false;
    setError(null);
    setSyncing(true);
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
      } finally {
        if (!stale) setSyncing(false);
      }
    }, 150);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [params]);

  const loaded = data ? [...data.rows, ...more] : [];
  // Layer 1: instant client reduction. Idempotent once the server answers for
  // this q (the server already ILIKE-filtered), so it's safe to apply always.
  const qn = q.trim().toLowerCase();
  const rows = qn ? loaded.filter((r) => clientMatch(r, qn)) : loaded;

  // Grows the loaded set on scroll (no "Load more" button). Offset is the count
  // of rows actually FETCHED (loaded), not the client-filtered subset shown.
  // Guarded so the bottom sentinel can fire repeatedly without stacking fetches,
  // running past the total, or racing a query the debounce is about to replace.
  const loadMore = async () => {
    if (busy || syncing || !data || loaded.length >= data.total) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rates/services?${params(loaded.length)}`);
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
        // While the server catches up, an empty client subset is NOT "no
        // results" — the full-corpus match may live beyond the loaded page.
        rows.length === 0 ? (
          <div className="rounded-card border border-border bg-surface shadow-card">
            {syncing ? (
              <EmptyState icon="search" title="Searching all published rates…" subtext="One moment." />
            ) : (
              <EmptyState icon="clipboard" title="No published rates match" subtext="Clear the search or a filter." />
            )}
          </div>
        ) : undefined
      }
      tableFooter={
        <p className="text-[13px] text-text-muted">
          Search <span className="tabular-nums">{data.total.toLocaleString("en-US")}</span> published rates. For Billing
          groups with more than 100 published rate rows see the corresponding <TextLink href="/orgs">organization</TextLink>.
          {syncing ? (
            <span className="ml-2">Searching all…</span>
          ) : (
            qn && (
              <span className="ml-2 tabular-nums">
                {rows.length.toLocaleString("en-US")} shown
              </span>
            )
          )}
          {busy && <span className="ml-2">Loading more…</span>}
        </p>
      }
    />
  );
}

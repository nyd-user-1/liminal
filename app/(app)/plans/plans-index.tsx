"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Employer } from "@/lib/repos/plans";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { IndexHeader } from "@/components/ui/index-header";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import { ChipMenu } from "@/components/rates/chip-menu";

// Plan sponsors — the employers behind the self-funded books. Public-record
// TiC/5500 data, not PHI.
//
// Facets are derived from the rows in hand, so an option that would return
// nothing is never offered. "New York only" used to be a bespoke button; it is
// now just one value of the State facet, under the standard Filter button.

type Filters = { state?: string; funding?: string; market?: string };

export function PlansIndex({ employers }: { employers: Employer[] }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const facets = useMemo(() => {
    const states = new Map<string, number>();
    const markets = new Map<string, number>();
    for (const e of employers) {
      if (e.state) states.set(e.state, (states.get(e.state) ?? 0) + 1);
      if (e.marketType) markets.set(e.marketType, (markets.get(e.marketType) ?? 0) + 1);
    }
    const byCount = (a: [string, number], b: [string, number]) => b[1] - a[1];
    return {
      states: [...states.entries()].sort(byCount).map(([value]) => ({ value, label: value })),
      markets: [...markets.entries()].sort(byCount).map(([value]) => ({ value, label: sentenceCase(value) })),
    };
  }, [employers]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return employers.filter((e) => {
      if (filters.state && e.state !== filters.state) return false;
      if (filters.market && e.marketType !== filters.market) return false;
      if (filters.funding && String(!!e.selfFunded) !== filters.funding) return false;
      if (!term) return true;
      return e.name.toLowerCase().includes(term) || e.ein.includes(term);
    });
  }, [employers, q, filters]);

  const open = (e: Employer) => router.push(`/plans/${e.ein}`);
  const hasFilters = !!(q || filters.state || filters.market || filters.funding);

  const columns: DataTableColumn<Employer>[] = [
    {
      key: "name",
      label: "Plan sponsor",
      fixed: true,
      sortValue: (e) => titleCase(e.name),
      cellClassName: "max-w-96",
      render: (e) => (
        <TextLink href={`/plans/${e.ein}`} onClick={(ev) => ev.stopPropagation()} variant="name">
          {titleCase(e.name)}
        </TextLink>
      ),
    },
    {
      key: "ein",
      label: "EIN",
      sortValue: (e) => e.ein,
      render: (e) => <span className="font-mono text-[13px] tabular-nums text-text-muted">{formatEin(e.ein)}</span>,
    },
    {
      key: "funding",
      label: "Funding",
      sortValue: (e) => (e.selfFunded ? "Self-funded" : "Insured"),
      render: (e) => (e.selfFunded ? <Badge variant="info">Self-funded</Badge> : <Badge variant="neutral">Insured</Badge>),
    },
    // market_type comes back on every row of the sponsors query and was never
    // rendered — it is the difference between an employer book and an
    // individual one, which is the first thing you want to know here.
    {
      key: "market",
      label: "Market",
      sortValue: (e) => e.marketType ?? "",
      render: (e) => <span className="text-text-body">{e.marketType ? sentenceCase(e.marketType) : "—"}</span>,
    },
    { key: "state", label: "State", sortValue: (e) => e.state ?? "", render: (e) => <span className="text-text-body">{e.state ?? "—"}</span> },
    {
      key: "plans",
      label: "Plans",
      align: "right",
      sortValue: (e) => e.planCount,
      render: (e) => <span className="tabular-nums text-text-body">{e.planCount}</span>,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* This page had no TopBar actions and no tab row at all. */}
      <IndexHeader
        tabs={[{ key: "all", label: "All Sponsors", count: employers.length }]}
        active="all"
        newLabel="New sponsor"
        onNew={() => toast("Plan sponsors come from the filings — there’s nothing to create here.", "info")}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(e) => e.ein}
        storageKey="plans.columns"
        defaultSort={{ col: "plans", dir: "desc" }}
        lazy
        fillHeight
        className="min-h-0 flex-1"
        onRowClick={open}
        selected={selected}
        onSelectedChange={setSelected}
        onExport={() => toast("Export isn’t wired up yet.", "info")}
        onRefresh={() => router.refresh()}
        filter={
          <>
            <ChipMenu
              label="State"
              icon="list-filter"
              options={facets.states}
              value={filters.state}
              onSelect={(v) => setFilters((f) => ({ ...f, state: v }))}
              onClear={() => setFilters((f) => ({ ...f, state: undefined }))}
            />
            <ChipMenu
              label="Funding"
              options={[
                { value: "true", label: "Self-funded" },
                { value: "false", label: "Insured" },
              ]}
              value={filters.funding}
              onSelect={(v) => setFilters((f) => ({ ...f, funding: v }))}
              onClear={() => setFilters((f) => ({ ...f, funding: undefined }))}
            />
            {facets.markets.length > 1 && (
              <ChipMenu
                label="Market"
                options={facets.markets}
                value={filters.market}
                onSelect={(v) => setFilters((f) => ({ ...f, market: v }))}
                onClear={() => setFilters((f) => ({ ...f, market: undefined }))}
              />
            )}
          </>
        }
        rowActions={(e) => (
          <KebabMenu label={`Actions for ${titleCase(e.name)}`}>
            <MenuItem icon="eye" label="Open sponsor" onClick={() => open(e)} />
          </KebabMenu>
        )}
        records={filtered.length}
        toolbarLeft={
          <>
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search employers or EIN…"
              className="max-w-md flex-1"
            />
            {hasFilters && (
              <TextLink
                onClick={() => {
                  setQ("");
                  setFilters({});
                }}
              >
                Reset
              </TextLink>
            )}
          </>
        }
        footnote={
          filtered.length === 0 ? (
            <div className="rounded-card border border-border bg-surface shadow-card">
              <EmptyState
                icon="credit-card"
                title="No plan sponsors match"
                subtext="Try a different employer name, EIN, or filter."
              />
            </div>
          ) : (
            <p className="text-[13px] text-text-muted tabular-nums">
              {filtered.length.toLocaleString()} of {employers.length.toLocaleString()} sponsors.
            </p>
          )
        }
      />
    </div>
  );
}

function formatEin(ein: string): string {
  const m = ein.match(/^(\d{2})(\d{7})$/);
  return m ? `${m[1]}-${m[2]}` : ein;
}

// market_type arrives lowercase ("group", "individual") — titleCase only softens
// ALL-CAPS filing names, so it would leave these untouched.
function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// employer names arrive UPPERCASE from the filings; soften to title case
function titleCase(s: string): string {
  return s.replace(/\b([A-Z])([A-Z']+)\b/g, (_, a, b) => a + b.toLowerCase())
    .replace(/\bLlc\b/i, "LLC").replace(/\bInc\b/i, "Inc").replace(/\bPc\b/i, "PC")
    .replace(/\bUsa\b/i, "USA").replace(/\bNy\b/i, "NY").replace(/\bMta\b/i, "MTA");
}

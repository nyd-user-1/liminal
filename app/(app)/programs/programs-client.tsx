"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { LoadMoreRow, SortableHead, Table, Td, Tr, useSentinel, useSort } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import { ChipMenu, DetailPanel, type ClientOption } from "@/app/(app)/directory/directory-client";
import { titleCase } from "@/lib/format";
import type { DirectoryProgram } from "@/lib/types";

// /programs — the NY OMH mental-health program directory as its own page
// (founder cut 2026-07-23: Programs no longer lives as a /directory tab, so
// the provider drill-down owns that page's tab rail). Same anatomy as every
// table: search + filter chips inside the chrome, select first, kebab last,
// standard footer; rows open the program side panel with the Refer flow.

export type Facets = { counties: string[]; types?: string[]; professions?: string[]; subspecialties?: string[] };

export function ProgramsClient({ facets, clients }: { facets: Facets; clients: ClientOption[] }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [county, setCounty] = useState<string | undefined>();
  const [type, setType] = useState<string | undefined>();

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DirectoryProgram[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selected, setSelected] = useState<DirectoryProgram | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sort, toggleSort] = useSort<"name" | "agency" | "county">({ col: "name", dir: "asc" });

  const loadSeq = useRef(0);
  const load = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      const seq = ++loadSeq.current;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      const params = new URLSearchParams();
      const term = q.trim();
      if (term) params.set(/^\d{3,5}$/.test(term) ? "zip" : "q", term);
      if (county) params.set("county", county);
      if (type) params.set("type", type);
      params.set("page", String(pageToLoad));
      try {
        const res = await fetch(`/api/directory/programs?${params.toString()}`);
        const data = await res.json();
        if (seq !== loadSeq.current) return;
        setItems((prev) => (replace ? (data.items ?? []) : [...prev, ...(data.items ?? [])]));
        setTotal(data.total ?? 0);
        setPage(pageToLoad);
      } finally {
        if (seq === loadSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [q, county, type],
  );

  useEffect(() => {
    const t = setTimeout(() => load(1, true), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const hasMore = items.length < total;
  const sentinelRef = useSentinel(() => load(page + 1, false), hasMore && !loading && !loadingMore);

  const sorted = [...items].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.col === "agency") return (a.agency ?? "").localeCompare(b.agency ?? "") * dir;
    if (sort.col === "county") return (a.county ?? "").localeCompare(b.county ?? "") * dir;
    return a.programName.localeCompare(b.programName) * dir;
  });

  const allChecked = items.length > 0 && items.every((r) => checked.has(r.id));
  const hasFilters = !!(q || county || type);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Table
        className="min-h-0 flex-1"
        stickyHeader
        toolbar={
          <>
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by program, agency or city"
              className="w-full sm:w-[380px]"
            />
            <ChipMenu
              label="County"
              value={county ? titleCase(county) : undefined}
              options={facets.counties}
              onSelect={(v: string) => setCounty(v)}
              onClear={() => setCounty(undefined)}
            />
            <ChipMenu
              label="Type"
              value={type ? titleCase(type) : undefined}
              options={facets.types ?? []}
              onSelect={(v: string) => setType(v)}
              onClear={() => setType(undefined)}
            />
            {hasFilters && (
              <TextLink
                onClick={() => {
                  setQ("");
                  setCounty(undefined);
                  setType(undefined);
                }}
              >
                Reset
              </TextLink>
            )}
            <span className="ml-auto">
              <KebabMenu label="Table options" icon="dots-horizontal">
                <MenuItem icon="download" label="Export" onClick={() => toast("Export isn’t wired up yet.", "info")} />
                <MenuItem icon="refresh-cw" label="Refresh" onClick={() => load(1, true)} />
              </KebabMenu>
            </span>
          </>
        }
        footer={
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-text-muted">
            <span className="min-w-0 truncate tabular-nums">{total.toLocaleString("en-US")} records</span>
            <span className="shrink-0">Data set by NYSgpt</span>
          </div>
        }
        head={[
          <Checkbox
            key="all"
            aria-label="Select all loaded"
            checked={allChecked}
            onChange={() =>
              setChecked((s) => {
                const next = new Set(s);
                items.forEach((r) => (allChecked ? next.delete(r.id) : next.add(r.id)));
                return next;
              })
            }
          />,
          <SortableHead key="name" label="Program" col="name" sort={sort} onSort={toggleSort} />,
          <SortableHead key="agency" label="Agency" col="agency" sort={sort} onSort={toggleSort} />,
          "Type",
          <SortableHead key="county" label="County" col="county" sort={sort} onSort={toggleSort} />,
          "",
        ]}
      >
        {!loading && sorted.length === 0 && (
          <Tr>
            <Td colSpan={6}>
              <EmptyState icon="globe" title="No programs match" subtext="Try a broader search or clear the filters." />
            </Td>
          </Tr>
        )}
        {sorted.map((r) => (
          <Tr key={r.id} onClick={() => setSelected(r)}>
            <Td className="w-10" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                aria-label={`Select ${r.programName}`}
                checked={checked.has(r.id)}
                onChange={() =>
                  setChecked((s) => {
                    const next = new Set(s);
                    if (!next.delete(r.id)) next.add(r.id);
                    return next;
                  })
                }
              />
            </Td>
            <Td className="max-w-64">
              <TextLink variant="name" className="min-w-0 truncate" title={r.programName} onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
                {r.programName}
              </TextLink>
            </Td>
            <Td className="max-w-40 truncate" title={r.agency ?? undefined}>{r.agency ?? "–"}</Td>
            <Td className="max-w-48 truncate" title={r.programType ?? undefined}>{r.programType ?? "–"}</Td>
            <Td className="max-w-32 truncate" title={r.county ?? undefined}>{r.county ?? "–"}</Td>
            <Td className="w-12" onClick={(e) => e.stopPropagation()}>
              <KebabMenu label={`Actions for ${r.programName}`}>
                <MenuItem icon="globe" label="View details" onClick={() => setSelected(r)} />
                <MenuItem icon="send" label="Refer a client" onClick={() => setSelected(r)} />
              </KebabMenu>
            </Td>
          </Tr>
        ))}
        {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={6} />}
      </Table>

      <DetailPanel
        item={selected}
        onClose={() => setSelected(null)}
        clients={clients}
        onReferred={() => toast("Referral sent.", "success")}
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { shortProfession } from "@/lib/format";
import type { RatedProvider } from "@/lib/repos/rate-directory";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { TextLink } from "@/components/ui/text-link";
import { Toolbar } from "@/components/ui/toolbar";
import {
  LoadMoreRow,
  SortableHead,
  Table,
  Td,
  Tr,
  useLazyBatch,
  useSort,
} from "@/components/ui/table";

type SortCol = "breadth" | "b90791" | "b90837" | "b99214";

// Ranked, searchable provider rate-directory — every provider we hold rates
// for, their payer breadth + best per-session negotiated rate per code. Rates
// are per-session, not revenue; they never sum across payers or codes.
export function RateDirectory({ providers }: { providers: RatedProvider[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, toggleSort] = useSort<SortCol>({ col: "breadth", dir: "desc" });
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toast = useToast();

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return providers;
    return providers.filter((p) => p.name.toLowerCase().includes(t) || p.npi.includes(t) || (p.profession ?? "").toLowerCase().includes(t));
  }, [providers, q]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const key: Record<SortCol, (p: RatedProvider) => number> = {
      breadth: (p) => p.payerCount,
      b90791: (p) => p.best90791 ?? -1,
      b90837: (p) => p.best90837 ?? -1,
      b99214: (p) => p.best99214 ?? -1,
    };
    return [...filtered].sort((a, b) => (key[sort.col](a) - key[sort.col](b)) * dir);
  }, [filtered, sort]);

  const { visible: rows, hasMore, sentinelRef } = useLazyBatch(sorted, { resetKey: `${q}|${sort.col}|${sort.dir}` });
  const money = (v: number | null) => (v == null ? "—" : `$${v.toFixed(2)}`);
  const go = (p: RatedProvider) => router.push(p.slug ? `/directory/${p.slug}` : `/rates?npi=${p.npi}`);

  const columns: DataTableColumn<RatedProvider>[] = [
    {
      key: "provider",
      label: "Provider",
      fixed: true,
      sortValue: (p) => displayName(p.name),
      render: (p) => (
        <TextLink href={p.slug ? `/directory/${p.slug}` : `/rates?npi=${p.npi}`} onClick={(e) => e.stopPropagation()} variant="name">
          {displayName(p.name)}
        </TextLink>
      ),
    },
    { key: "type", label: "Type", sortValue: (p) => p.profession ?? "", render: (p) => <span className="text-text-muted">{shortProfession(p.profession)}</span> },
    { key: "breadth", label: "Books", sortValue: (p) => p.payerCount, render: (p) => <Badge variant={p.payerCount >= 4 ? "info" : "neutral"}>{p.payerCount}</Badge> },
    { key: "b90791", label: "Eval rate", align: "right", sortValue: (p) => p.best90791 ?? -1, render: (p) => <span className="text-text-body">{money(p.best90791)}</span> },
    { key: "b90837", label: "Therapy rate", align: "right", sortValue: (p) => p.best90837 ?? -1, render: (p) => <span className="font-medium text-text">{money(p.best90837)}</span> },
    { key: "b99214", label: "Med-mgmt rate", align: "right", sortValue: (p) => p.best99214 ?? -1, render: (p) => <span className="text-text-body">{money(p.best99214)}</span> },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBarActions>
        <Button size="sm" leftIcon="plus" onClick={() => toast("New shortlist isn\u2019t wired up yet.", "info")}>
          New shortlist
        </Button>
        <IconButton icon="bell" label="Notifications" onClick={() => toast("No new notifications.", "info")} />
      </TopBarActions>

      <Tabs
        className="mt-4 mb-4 shrink-0"
        slideActive
        active={tab}
        onChange={setTab}
        items={[
          { key: "all", label: "All Providers" },
          { key: "tab2", label: "Tab 2" },
          { key: "tab3", label: "Tab 3" },
          { key: "tab4", label: "Tab 4" },
        ]}
      />

      <DataTable
        columns={columns}
        rows={sorted}
        rowKey={(p) => p.npi}
        storageKey="recruiting.columns"
        lazy
        fillHeight
        className="min-h-0 flex-1"
        onRowClick={(p) => go(p)}
        selected={selected}
        onSelectedChange={setSelected}
        onExport={() => toast("Export isn\u2019t wired up yet.", "info")}
        onRefresh={() => router.refresh()}
        rowActions={(p) => (
          <KebabMenu label={`Actions for ${displayName(p.name)}`}>
            <MenuItem icon="person-circle" label="Open provider" onClick={() => go(p)} />
          </KebabMenu>
        )}
        toolbarLeft={
          <>
            <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search providers by name or NPI…" className="max-w-md flex-1" />
            <span className="self-center text-sm text-text-muted tabular-nums">
              {sorted.length.toLocaleString()} of {providers.length.toLocaleString()} rated providers
            </span>
          </>
        }
        footnote={
          <p className="text-[12px] text-text-muted">
            Best per-session negotiated rate the provider commands across the NY payer books we index. Per-session, not revenue &mdash; rates never sum across payers or codes. As published; presence isn&rsquo;t proof of an open panel.
          </p>
        }
      />
    </div>
  );
}

// NPPES stores "LAST FIRST [MIDDLE] [SUFFIX]"; show "First Last". Heuristic:
// strip trailing credential suffixes, move the first token to the end.
const SUFFIX = /\b(LCSW|LMHC|LMFT|LCAT|PHD|PSYD|MD|DO|NP|PMHNP|CRNP|RN|MSW|PC|PLLC)\b/gi;
function displayName(raw: string): string {
  const clean = raw.replace(SUFFIX, "").replace(/\s+/g, " ").trim();
  const parts = clean.split(" ");
  const reordered = parts.length >= 2 ? [...parts.slice(1), parts[0]] : parts;
  return reordered.map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

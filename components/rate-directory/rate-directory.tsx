"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RatedProvider } from "@/lib/repos/rate-directory";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar className="mb-4 shrink-0 md:mb-6">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search providers by name or NPI…" className="max-w-md flex-1" />
        <span className="ml-auto self-center text-sm text-text-muted tabular-nums">
          {sorted.length.toLocaleString()} of {providers.length.toLocaleString()} rated providers
        </span>
      </Toolbar>

      {rows.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          <EmptyState icon="users" title="No providers match" subtext="Try a different name or NPI." />
        </div>
      ) : (
        <Table
          className="min-h-0 flex-1"
          stickyHeader
          head={[
            "Provider",
            <SortableHead key="breadth" label="Payer books" col="breadth" sort={sort} onSort={toggleSort} />,
            <SortableHead key="b90791" label="90791 eval" col="b90791" sort={sort} onSort={toggleSort} />,
            <SortableHead key="b90837" label="90837 60-min" col="b90837" sort={sort} onSort={toggleSort} />,
            <SortableHead key="b99214" label="99214 E/M" col="b99214" sort={sort} onSort={toggleSort} />,
          ]}
        >
          {rows.map((p) => (
            <Tr key={p.npi} onClick={() => go(p)}>
              <Td className="whitespace-nowrap">
                <TextLink href={p.slug ? `/directory/${p.slug}` : `/rates?npi=${p.npi}`} onClick={(e) => e.stopPropagation()} className="!font-medium">
                  {titleCase(p.name)}
                </TextLink>
                <span className="block text-[12.5px] text-text-muted">{p.profession ?? "—"}</span>
              </Td>
              <Td><Badge variant={p.payerCount >= 4 ? "info" : "neutral"}>{p.payerCount} book{p.payerCount === 1 ? "" : "s"}</Badge></Td>
              <Td className="tabular-nums text-text-body">{money(p.best90791)}</Td>
              <Td className="font-medium tabular-nums text-text">{money(p.best90837)}</Td>
              <Td className="tabular-nums text-text-body">{money(p.best99214)}</Td>
            </Tr>
          ))}
          {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={5} />}
        </Table>
      )}
      <p className="mt-3 shrink-0 text-[12px] text-text-muted">
        Best per-session negotiated rate the provider commands across the NY payer books we index. Per-session, not revenue &mdash; rates never sum across payers or codes. As published; presence isn&rsquo;t proof of an open panel.
      </p>
    </div>
  );
}

function titleCase(s: string): string {
  return s.replace(/\b([A-Z])([A-Z']+)\b/g, (_, a, b) => a + b.toLowerCase());
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Employer } from "@/lib/repos/plans";
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

type SortCol = "name" | "state" | "plans";

export function PlansIndex({ employers }: { employers: Employer[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [nyOnly, setNyOnly] = useState(false);
  const [sort, toggleSort] = useSort<SortCol>({ col: "plans", dir: "desc" });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return employers.filter((e) => {
      if (nyOnly && e.state !== "NY") return false;
      if (!term) return true;
      return e.name.toLowerCase().includes(term) || e.ein.includes(term);
    });
  }, [employers, q, nyOnly]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.col === "plans") return (a.planCount - b.planCount) * dir;
      if (sort.col === "state") return (a.state ?? "").localeCompare(b.state ?? "") * dir;
      return a.name.localeCompare(b.name) * dir;
    });
  }, [filtered, sort]);

  const { visible: rows, hasMore, sentinelRef } = useLazyBatch(sorted, {
    resetKey: `${q}|${nyOnly}|${sort.col}|${sort.dir}`,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar className="mb-4 shrink-0 md:mb-6">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search employers or EIN…"
          className="max-w-md flex-1"
        />
        <button
          type="button"
          onClick={() => setNyOnly((v) => !v)}
          className={`rounded-field border px-3 py-1.5 text-sm font-medium transition-colors ${
            nyOnly
              ? "border-primary bg-primary-wash text-primary"
              : "border-field-border text-text-body hover:border-field-border-focus"
          }`}
        >
          New York only
        </button>
        <span className="ml-auto self-center text-sm text-text-muted tabular-nums">
          {sorted.length.toLocaleString()} of {employers.length.toLocaleString()} sponsors
        </span>
      </Toolbar>

      {rows.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          <EmptyState
            icon="credit-card"
            title="No plan sponsors match"
            subtext="Try a different employer name or EIN."
          />
        </div>
      ) : (
        <Table
          className="min-h-0 flex-1"
          stickyHeader
          head={[
            <SortableHead key="name" label="Plan sponsor" col="name" sort={sort} onSort={toggleSort} />,
            "EIN",
            "Funding",
            <SortableHead key="state" label="State" col="state" sort={sort} onSort={toggleSort} />,
            <SortableHead key="plans" label="Plans" col="plans" sort={sort} onSort={toggleSort} />,
          ]}
        >
          {rows.map((e) => (
            <Tr key={e.ein} onClick={() => router.push(`/plans/${e.ein}`)}>
              <Td className="whitespace-nowrap">
                <TextLink
                  href={`/plans/${e.ein}`}
                  onClick={(ev) => ev.stopPropagation()}
                  className="!font-medium"
                >
                  {titleCase(e.name)}
                </TextLink>
              </Td>
              <Td className="whitespace-nowrap font-mono text-[13px] text-text-muted tabular-nums">
                {formatEin(e.ein)}
              </Td>
              <Td>
                {e.selfFunded ? (
                  <Badge variant="info">Self-funded</Badge>
                ) : (
                  <Badge variant="neutral">Insured</Badge>
                )}
              </Td>
              <Td className="text-text-body">{e.state ?? "—"}</Td>
              <Td className="tabular-nums text-text-body">{e.planCount}</Td>
            </Tr>
          ))}
          {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={5} />}
        </Table>
      )}
    </div>
  );
}

function formatEin(ein: string): string {
  const m = ein.match(/^(\d{2})(\d{7})$/);
  return m ? `${m[1]}-${m[2]}` : ein;
}

// employer names arrive UPPERCASE from the filings; soften to title case
function titleCase(s: string): string {
  return s.replace(/\b([A-Z])([A-Z']+)\b/g, (_, a, b) => a + b.toLowerCase())
    .replace(/\bLlc\b/i, "LLC").replace(/\bInc\b/i, "Inc").replace(/\bPc\b/i, "PC")
    .replace(/\bUsa\b/i, "USA").replace(/\bNy\b/i, "NY").replace(/\bMta\b/i, "MTA");
}

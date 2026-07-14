"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { SortableHead, Table, Td, Tr, useSort } from "@/components/ui/table";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import type { OrgListRow } from "@/lib/repos/orgs";

// Organizations index — search box above a ranked table (biggest rosters
// first). Search re-queries /api/orgs (debounced); a row opens the org
// workspace. Named rows show the org name; unnamed TINs show the formatted
// EIN with an "unnamed" chip (we only ever attest names we can source).

type Col = "org" | "npis" | "payers" | "seen";

function href(tin: string) {
  return `/orgs/${encodeURIComponent(tin)}`;
}

export function OrgsIndex({ initial }: { initial: OrgListRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<OrgListRow[] | null>(initial);
  const [sort, toggleSort] = useSort<Col>({ col: "npis", dir: "desc" });
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const s = ++seq.current;
    // Empty query → the server-seeded ranked list, no round-trip.
    if (!term) {
      setRows(initial);
      return;
    }
    setRows(null);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/orgs?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        if (s === seq.current) setRows((data.orgs ?? []) as OrgListRow[]);
      } catch {
        if (s === seq.current) setRows([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, initial]);

  const sorted = rows ? sortRows(rows, sort.col, sort.dir) : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-1">
        <SearchInput
          aria-label="Search organizations"
          placeholder="Search organizations by name…"
          className="w-full max-w-md"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQ("")}
        />
        <p className="text-sm text-text-muted">
          Contract-holding billing entities (TINs) seen across payer rate files — ranked by roster size.
          Only names we can source from a payer roster or the NPI registry are shown.
        </p>
      </div>

      {sorted === null ? (
        <TableSkeleton head={["Organization", "Clinicians", "Payer books", "Last seen"]} />
      ) : sorted.length === 0 ? (
        <Card className="grid place-items-center py-16 text-center text-text-muted">
          No organizations match “{q.trim()}”.
        </Card>
      ) : (
        <Table
          className="min-h-0 flex-1"
          stickyHeader
          head={[
            <SortableHead key="org" label="Organization" col="org" sort={sort} onSort={toggleSort} />,
            <SortableHead key="npis" label="Clinicians" col="npis" sort={sort} onSort={toggleSort} />,
            <SortableHead key="payers" label="Payer books" col="payers" sort={sort} onSort={toggleSort} />,
            <SortableHead key="seen" label="Last seen" col="seen" sort={sort} onSort={toggleSort} />,
          ]}
        >
          {sorted.map((o) => (
            <Tr key={o.tin} onClick={() => router.push(href(o.tin))}>
              <Td className="max-w-[28rem]">
                {o.name ? (
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
                )}
              </Td>
              <Td className="whitespace-nowrap tabular-nums font-medium text-text">
                {o.npis.toLocaleString()}
              </Td>
              <Td className="whitespace-nowrap tabular-nums text-text-body">{o.payerCount}</Td>
              <Td className="whitespace-nowrap text-text-muted">{o.lastFileDate ?? "—"}</Td>
            </Tr>
          ))}
        </Table>
      )}
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

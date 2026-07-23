"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { useToast } from "@/components/ui/toast";
import type { CodeRow } from "@/lib/repos/codes";

// The billing codes as a sortable table (DataTable, stacked), default-ranked by
// rate-row volume. The "In /rates" column is the point of the page: the five
// codes the /rates panels surface today wear a teal badge, the fifteen priced
// but not yet shown wear a muted one — the NYS-50 surfacing gap, at a glance.

const num = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US"));

const columns: DataTableColumn<CodeRow>[] = [
  {
    key: "code",
    label: "Code",
    fixed: true,
    sortValue: (r) => r.code,
    render: (r) => <span className="font-mono text-[13px] text-text">{r.code}</span>,
  },
  {
    key: "description",
    label: "Description",
    cellClassName: "max-w-sm truncate",
    sortValue: (r) => r.description,
    render: (r) => (
      <span className="text-text" title={r.description}>
        {r.description}
      </span>
    ),
  },
  {
    key: "category",
    label: "Category",
    sortValue: (r) => r.category ?? "~",
    render: (r) => <span className="text-text-muted">{r.category ?? "—"}</span>,
  },
  {
    key: "npis",
    label: "Providers priced",
    align: "right",
    sortValue: (r) => r.npis ?? -1,
    render: (r) => <span className="tabular-nums text-text-body">{num(r.npis)}</span>,
  },
  {
    key: "rows",
    label: "Rate rows",
    align: "right",
    sortValue: (r) => r.rows ?? -1,
    render: (r) => <span className="tabular-nums text-text-body">{num(r.rows)}</span>,
  },
  {
    key: "rates",
    label: "In /rates",
    sortValue: (r) => (r.shownInRates ? 0 : 1),
    render: (r) =>
      r.shownInRates ? (
        <Badge variant="success">Shown</Badge>
      ) : (
        <Badge variant="neutral">Not yet</Badge>
      ),
  },
];

export function CodesTable({ codes }: { codes: CodeRow[] }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle
      ? codes.filter((r) => r.code.includes(needle) || r.description.toLowerCase().includes(needle))
      : codes;
  }, [codes, q]);
  return (
    <DataTable
      columns={columns}
      rows={shown}
      rowKey={(r) => r.code}
      defaultSort={{ col: "rows", dir: "desc" }}
      toolbarLeft={
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by code or description"
          className="w-full sm:w-[320px]"
        />
      }
      rowActions={(r) => (
        <KebabMenu label={`Actions for ${r.code}`}>
          <MenuItem
            icon="copy"
            label="Copy code"
            onClick={() => {
              void navigator.clipboard.writeText(r.code);
              toast(`${r.code} copied.`, "success");
            }}
          />
        </KebabMenu>
      )}
      records={codes.length}
    />
  );
}

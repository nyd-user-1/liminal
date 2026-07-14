"use client";

import type { InsurerBoardRow } from "@/lib/repos/admin";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { InsurerCell } from "@/components/rates/insurer-mark";

function fmt(n: number | undefined): string {
  return n === undefined ? "—" : n.toLocaleString("en-US");
}

// -1 sorts blank/no-data rows to the bottom on a descending (large→small) sort.
const num = (n: number | undefined) => n ?? -1;

const COLUMNS: DataTableColumn<InsurerBoardRow>[] = [
  { key: "name", label: "Insurer", fixed: true, sortValue: (r) => r.name, render: (r) => <InsurerCell payer={r.name} /> },
  { key: "membershipNpis", label: "Membership NPIs", align: "right", sortValue: (r) => num(r.membership?.npis), render: (r) => fmt(r.membership?.npis) },
  { key: "networks", label: "Networks", align: "right", sortValue: (r) => num(r.membership?.networks), render: (r) => fmt(r.membership?.networks) },
  { key: "ratedNpis", label: "Rated NPIs", align: "right", sortValue: (r) => num(r.rates?.npis), render: (r) => fmt(r.rates?.npis) },
  { key: "rateRows", label: "Rate rows", align: "right", sortValue: (r) => num(r.rates?.rows), render: (r) => fmt(r.rates?.rows) },
  { key: "lastActivity", label: "Last activity", sortValue: (r) => r.lastActivity ?? "", render: (r) => r.lastActivity ?? "—" },
  {
    key: "note",
    label: "Note",
    cellClassName: "max-w-96 truncate",
    render: (r) => (
      <span className="truncate" title={r.note}>
        {r.note}
      </span>
    ),
  },
];

export function InsurersBoard({ rows }: { rows: InsurerBoardRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.name}
      rowClassName={(r) => (r.isOther ? "bg-canvas/60" : undefined)}
      storageKey="admin.insurers.columns"
      footnote={<p className="text-sm text-text-muted">Counts are live; a running harvest moves Membership within minutes.</p>}
    />
  );
}

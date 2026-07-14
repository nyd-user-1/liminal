"use client";

import type { InsurerBoardRow } from "@/lib/repos/admin";
import { InsurerCell } from "@/components/rates/insurer-mark";
import { Table, Td, Tr } from "@/components/ui/table";

const NUMERIC_HEAD = ["Membership NPIs", "Networks", "Rated NPIs", "Rate rows"];
const HEAD = ["Insurer", ...NUMERIC_HEAD.map((h) => <span key={h} className="block text-right">{h}</span>), "Last activity", "Note"];

function fmt(n: number | undefined): string {
  return n === undefined ? "—" : n.toLocaleString("en-US");
}

export function InsurersBoard({ rows }: { rows: InsurerBoardRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Table head={HEAD}>
        {rows.map((r) => (
          <Tr key={r.name} className={r.isOther ? "bg-canvas/60" : undefined}>
            <Td>
              <InsurerCell payer={r.name} />
            </Td>
            <Td className="whitespace-nowrap text-right tabular-nums">{fmt(r.membership?.npis)}</Td>
            <Td className="whitespace-nowrap text-right tabular-nums">{fmt(r.membership?.networks)}</Td>
            <Td className="whitespace-nowrap text-right tabular-nums">{fmt(r.rates?.npis)}</Td>
            <Td className="whitespace-nowrap text-right tabular-nums">{fmt(r.rates?.rows)}</Td>
            <Td className="whitespace-nowrap tabular-nums">{r.lastActivity ?? "—"}</Td>
            <Td className="text-text-muted">{r.note}</Td>
          </Tr>
        ))}
      </Table>
      <p className="text-sm text-text-muted">Counts are live; a running harvest moves Membership within minutes.</p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Table, Td, Tr } from "@/components/ui/table";
import { formatCents, formatDate } from "@/lib/format";
import type { InvoiceListItem } from "@/lib/repos/invoices";

// "Needs attention" table on the billing overview pane — rows navigate to
// the invoice. A table, not cards: full-width rows read as data here.
// Standard anatomy (2026-07-23): select first, kebab last, records footer.

export function AttentionTable({ invoices }: { invoices: InvoiceListItem[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <Table
      footer={
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-text-muted">
          <span className="min-w-0 truncate tabular-nums">{invoices.length.toLocaleString("en-US")} records</span>
          <span className="shrink-0">Data set by NYSgpt</span>
        </div>
      }
      head={[
        <Checkbox
          key="__sel"
          aria-label="Select all"
          checked={invoices.length > 0 && invoices.every((i) => sel.has(i.id))}
          onChange={() =>
            setSel((prev) => {
              const all = invoices.every((i) => prev.has(i.id));
              const next = new Set(prev);
              invoices.forEach((i) => (all ? next.delete(i.id) : next.add(i.id)));
              return next;
            })
          }
        />,
        "Client",
        "Invoice",
        "Due",
        "Status",
        "Balance",
        "",
      ]}
    >
      {invoices.map((inv) => (
        <Tr key={inv.id} onClick={() => router.push(`/billing/${inv.id}`)}>
          <Td className="w-10" onClick={(e) => e.stopPropagation()}>
            <Checkbox aria-label="Select row" checked={sel.has(inv.id)} onChange={() => toggle(inv.id)} />
          </Td>
          <Td className="font-medium text-text">{inv.clientName}</Td>
          <Td>{inv.number}</Td>
          <Td className={inv.status === "overdue" ? "font-medium text-danger" : ""}>
            {inv.dueOn ? formatDate(`${inv.dueOn}T00:00:00`) : "—"}
          </Td>
          <Td>
            <InvoiceStatusBadge status={inv.status} />
          </Td>
          <Td className="font-semibold">{formatCents(inv.balanceCents)}</Td>
          <Td className="w-12" onClick={(e) => e.stopPropagation()}>
            <KebabMenu label={`Actions for invoice ${inv.number}`}>
              <MenuItem icon="eye" label="Open invoice" onClick={() => router.push(`/billing/${inv.id}`)} />
            </KebabMenu>
          </Td>
        </Tr>
      ))}
    </Table>
  );
}

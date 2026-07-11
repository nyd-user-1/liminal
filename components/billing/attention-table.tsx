"use client";

import { useRouter } from "next/navigation";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { Table, Td, Tr } from "@/components/ui/table";
import { formatCents, formatDate } from "@/lib/format";
import type { InvoiceListItem } from "@/lib/repos/invoices";

// "Needs attention" table on the billing overview pane — rows navigate to
// the invoice. A table, not cards: full-width rows read as data here.

export function AttentionTable({ invoices }: { invoices: InvoiceListItem[] }) {
  const router = useRouter();
  return (
    <Table head={["Client", "Invoice", "Due", "Status", "Balance"]}>
      {invoices.map((inv) => (
        <Tr key={inv.id} onClick={() => router.push(`/billing/${inv.id}`)}>
          <Td className="font-medium text-text">{inv.clientName}</Td>
          <Td>{inv.number}</Td>
          <Td className={inv.status === "overdue" ? "font-medium text-danger" : ""}>
            {inv.dueOn ? formatDate(`${inv.dueOn}T00:00:00`) : "—"}
          </Td>
          <Td>
            <InvoiceStatusBadge status={inv.status} />
          </Td>
          <Td className="font-semibold">{formatCents(inv.balanceCents)}</Td>
        </Tr>
      ))}
    </Table>
  );
}

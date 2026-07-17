"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { NewInvoicePanel, type ServiceOption } from "@/components/billing/new-invoice-panel";
import { RecordPaymentModal, type PaymentTarget } from "@/components/billing/record-payment-modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Td, Tr } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate } from "@/lib/format";
import type { InvoiceListItem } from "@/lib/repos/invoices";

// Client Billing tab (interactive half) — StatCards + the client's invoice
// table + "+ New invoice" SidePanel scoped to this client.

export function ClientInvoices({
  clientId,
  invoices,
  summary,
  services,
  bare = false,
  newOpen: controlledNewOpen,
  onNewOpenChange,
}: {
  clientId: string;
  invoices: InvoiceListItem[];
  summary: { balanceCents: number; lastPaymentCents: number | null; lastPaymentAt: string | null };
  services: ServiceOption[];
  /** Board variant: the host card draws the title and carries New invoice. */
  bare?: boolean;
  /** Controlled when the host owns the New-invoice trigger — the same handshake
   *  the object tables use (components/tables/clients-table.tsx). */
  newOpen?: boolean;
  onNewOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [uncontrolledNewOpen, setUncontrolledNewOpen] = useState(false);
  const newInvoiceOpen = controlledNewOpen ?? uncontrolledNewOpen;
  const setNewInvoiceOpen = (open: boolean) =>
    onNewOpenChange ? onNewOpenChange(open) : setUncontrolledNewOpen(open);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);

  const patchInvoice = async (id: string, status: "sent" | "void", done: string) => {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "Update failed.", "danger");
      return;
    }
    toast(done, "success");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Outstanding balance" value={formatCents(summary.balanceCents)} />
        <StatCard
          label="Last payment"
          value={summary.lastPaymentCents != null ? formatCents(summary.lastPaymentCents) : "—"}
          corner={
            summary.lastPaymentAt ? (
              <span className="text-sm text-text-muted">{formatDate(summary.lastPaymentAt)}</span>
            ) : undefined
          }
        />
      </div>

      {!bare && (
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-semibold text-text">Invoices</h2>
          <Button size="sm" leftIcon="plus" onClick={() => setNewInvoiceOpen(true)}>
            New invoice
          </Button>
        </div>
      )}

      {invoices.length === 0 ? (
        <EmptyState
          icon="credit-card"
          title="No invoices yet"
          subtext="Create the first invoice for this client."
          actions={
            <Button leftIcon="plus" onClick={() => setNewInvoiceOpen(true)}>
              New invoice
            </Button>
          }
        />
      ) : (
        <Table head={["Invoice", "Issued", "Due", "Total", "Status", ""]}>
          {invoices.map((inv) => (
            <Tr key={inv.id} onClick={() => router.push(`/billing/${inv.id}`)}>
              <Td>
                <TextLink href={`/billing/${inv.id}`} onClick={(e) => e.stopPropagation()}>
                  {inv.number}
                </TextLink>
              </Td>
              <Td>{inv.issuedOn ? formatDate(`${inv.issuedOn}T00:00:00`) : "—"}</Td>
              <Td className={inv.status === "overdue" ? "font-medium text-danger" : ""}>
                {inv.dueOn ? formatDate(`${inv.dueOn}T00:00:00`) : "—"}
              </Td>
              <Td className="font-semibold">{formatCents(inv.totalCents)}</Td>
              <Td>
                <InvoiceStatusBadge status={inv.status} />
              </Td>
              <Td className="w-12 text-right" onClick={(e) => e.stopPropagation()}>
                <KebabMenu>
                  <MenuItem icon="file-text" label="Open" onClick={() => router.push(`/billing/${inv.id}`)} />
                  {inv.status !== "paid" && inv.status !== "void" && (
                    <MenuItem
                      icon="dollar"
                      label="Record payment"
                      onClick={() =>
                        setPaymentTarget({ id: inv.id, number: inv.number, balanceCents: inv.balanceCents })
                      }
                    />
                  )}
                  {inv.status === "draft" && (
                    <MenuItem
                      icon="send"
                      label="Mark sent"
                      onClick={() => patchInvoice(inv.id, "sent", `${inv.number} marked sent`)}
                    />
                  )}
                  {inv.status !== "paid" && inv.status !== "void" && (
                    <MenuItem
                      icon="x"
                      danger
                      label="Void invoice"
                      onClick={() => patchInvoice(inv.id, "void", `${inv.number} voided`)}
                    />
                  )}
                </KebabMenu>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      <NewInvoicePanel
        open={newInvoiceOpen}
        onClose={() => setNewInvoiceOpen(false)}
        clients={[]}
        services={services}
        defaultClientId={clientId}
      />
      <RecordPaymentModal
        invoice={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onRecorded={() => router.refresh()}
      />
    </div>
  );
}

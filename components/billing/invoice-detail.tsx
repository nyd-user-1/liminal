"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { RecordPaymentModal, type PaymentTarget } from "@/components/billing/record-payment-modal";
import { Banner } from "@/components/ui/banner";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { Icon } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Table, Td, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate, formatDateTime } from "@/lib/format";
import type { InvoiceDetail } from "@/lib/repos/invoices";

// Invoice detail — header (number + status + client), actions (record
// payment · collect online · print · mark sent / void), items table, totals,
// payments list. `Collect online` POSTs /api/stripe/checkout and follows the
// returned URL — a real Stripe Checkout with a key, the mock confirm
// redirect without one.

const METHOD_LABEL: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  insurance: "Insurance",
  other: "Other",
};

export function InvoiceDetailView({
  invoice,
  stripeConfigured,
  justPaid,
  canceled,
}: {
  invoice: InvoiceDetail;
  stripeConfigured: boolean;
  justPaid: boolean;
  canceled: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [collecting, setCollecting] = useState(false);

  const open = invoice.status !== "paid" && invoice.status !== "void";
  const collectable = open && invoice.balanceCents > 0;

  const patchStatus = async (status: "sent" | "void", done: string) => {
    const res = await fetch(`/api/invoices/${invoice.id}`, {
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

  const collectOnline = async () => {
    setCollecting(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout.");
      window.location.assign(data.url);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not start checkout.", "danger");
      setCollecting(false);
    }
  };

  return (
    <>
      <Breadcrumb className="mb-3" items={[{ label: "Billing", href: "/billing" }, { label: invoice.number }]} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Icon name="file-text" size={26} className="text-text-body" />
        <h1 className="text-[28px] font-bold text-text">{invoice.number}</h1>
        <InvoiceStatusBadge status={invoice.status} />
        <div className="ml-auto flex items-center gap-2.5">
          <Button
            variant="secondary"
            leftIcon="file-text"
            onClick={() => window.open(`/billing/${invoice.id}/print`, "_blank")}
          >
            Print
          </Button>
          {collectable && (
            <>
              <Button variant="secondary" leftIcon="dollar" onClick={() =>
                setPaymentTarget({ id: invoice.id, number: invoice.number, balanceCents: invoice.balanceCents })
              }>
                Record payment
              </Button>
              <Button leftIcon="credit-card" loading={collecting} onClick={collectOnline}>
                Collect online
              </Button>
            </>
          )}
          {open && (
            <KebabMenu>
              {invoice.status === "draft" && (
                <MenuItem
                  icon="send"
                  label="Mark sent"
                  onClick={() => patchStatus("sent", `${invoice.number} marked sent`)}
                />
              )}
              <MenuItem
                icon="x"
                danger
                label="Void invoice"
                onClick={() => patchStatus("void", `${invoice.number} voided`)}
              />
            </KebabMenu>
          )}
        </div>
      </div>

      {justPaid && (
        <Banner variant="success" className="mb-4">
          Payment collected — {invoice.number} is settled{stripeConfigured ? "." : " (simulated checkout)."}
        </Banner>
      )}
      {canceled && (
        <Banner variant="warning" className="mb-4">
          Checkout was canceled — no payment was taken.
        </Banner>
      )}
      {!stripeConfigured && collectable && (
        <Banner variant="info" className="mb-4">
          No Stripe key is configured (<code className="font-mono text-[13px]">STRIPE_SECRET_KEY</code>), so
          &ldquo;Collect online&rdquo; simulates a successful checkout and marks the invoice paid. With a key, the
          same button opens a real Stripe Checkout.
        </Banner>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Table head={["Description", "Qty", "Unit", "Amount"]}>
            {invoice.items.map((it) => (
              <Tr key={it.id}>
                <Td>{it.description}</Td>
                <Td>{it.qty}</Td>
                <Td>{formatCents(it.unitCents)}</Td>
                <Td className="font-semibold">{formatCents(it.amountCents)}</Td>
              </Tr>
            ))}
          </Table>

          <Card className="p-5">
            <h2 className="mb-3 text-[19px] font-semibold text-text">Payments</h2>
            {invoice.payments.length === 0 ? (
              <p className="text-[15px] text-text-muted">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5 text-[15px]">
                    <span className="text-text-body">
                      {METHOD_LABEL[p.method] ?? p.method}
                      {p.stripePaymentIntent && (
                        <span className="ml-2 font-mono text-[13px] text-text-muted">{p.stripePaymentIntent}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="text-text-muted">{formatDateTime(p.paidAt)}</span>
                      <span className="font-semibold text-text">{formatCents(p.amountCents)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-[19px] font-semibold text-text">Details</h2>
            <dl className="space-y-2.5 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-text-muted">Client</dt>
                <dd className="font-medium text-text">{invoice.clientName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Issued</dt>
                <dd className="text-text-body">{invoice.issuedOn ? formatDate(`${invoice.issuedOn}T00:00:00`) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Due</dt>
                <dd className={invoice.status === "overdue" ? "font-medium text-danger" : "text-text-body"}>
                  {invoice.dueOn ? formatDate(`${invoice.dueOn}T00:00:00`) : "—"}
                </dd>
              </div>
            </dl>
            <Divider className="my-4" />
            <dl className="space-y-2.5 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-text-muted">Subtotal</dt>
                <dd className="text-text-body">{formatCents(invoice.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Tax</dt>
                <dd className="text-text-body">{formatCents(invoice.taxCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium text-text">Total</dt>
                <dd className="font-semibold text-text">{formatCents(invoice.totalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Paid</dt>
                <dd className="text-text-body">{formatCents(invoice.paidCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium text-text">Balance</dt>
                <dd className={`font-semibold ${invoice.balanceCents > 0 && open ? "text-danger" : "text-success"}`}>
                  {formatCents(invoice.balanceCents)}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <RecordPaymentModal
        invoice={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onRecorded={() => router.refresh()}
      />
    </>
  );
}

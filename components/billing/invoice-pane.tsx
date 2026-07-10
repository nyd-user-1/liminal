"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { RecordPaymentModal, type PaymentTarget } from "@/components/billing/record-payment-modal";
import { Avatar } from "@/components/ui/avatar";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate, formatDateTime } from "@/lib/format";
import type { InvoiceDetail } from "@/lib/repos/invoices";

// Invoice pane — the right side of the billing split view: a document-style
// read of the invoice (bill to · items · totals · payments) with every
// billing action inline — Send (email via Resend), Record payment, Collect
// online, Print, Copy pay link, Void. The biller never leaves /billing.

const METHOD_LABEL: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  insurance: "Insurance",
  other: "Other",
};

const dateOnly = (d: string) => formatDate(`${d}T00:00:00`);

// Send-invoice Modal — recipient defaults to the client's email but stays
// editable (Resend's dev sender only delivers to the account owner's inbox,
// so demos send to yourself). Sending a draft marks it sent.
function SendInvoiceModal({
  invoice,
  open,
  onClose,
}: {
  invoice: InvoiceDetail;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [to, setTo] = useState(invoice.client?.email ?? "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setTo(invoice.client?.email ?? "");
  }, [open, invoice.client?.email]);

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the invoice.");
      toast(
        data.emailed
          ? `${invoice.number} emailed to ${data.to}`
          : `${invoice.number} marked sent — email isn't configured in this environment`,
        data.emailed ? "success" : "warning",
      );
      onClose();
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not send the invoice.", "danger");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send invoice"
      icon="send"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button leftIcon="send" onClick={send} loading={sending}>
            Send invoice
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-field bg-canvas px-4 py-3 text-[15px]">
          <span className="min-w-0 truncate text-text-body">
            {invoice.number} · {invoice.clientName}
          </span>
          <span className="shrink-0 font-semibold text-text">{formatCents(invoice.balanceCents)}</span>
        </div>
        <Field
          label="Send to"
          type="email"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="client@email.com"
          hint="Defaults to the client's email on file."
        />
        <p className="text-[13px] text-text-muted">
          The client receives a branded summary with a secure &ldquo;View &amp; pay&rdquo; link to their portal
          {invoice.status === "draft" ? "; sending marks this invoice as sent" : ""}.
        </p>
      </div>
    </Modal>
  );
}

export function InvoicePane({
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
  const [sendOpen, setSendOpen] = useState(false);
  const [collecting, setCollecting] = useState(false);

  const open = invoice.status !== "paid" && invoice.status !== "void";
  const collectable = open && invoice.balanceCents > 0;

  const voidInvoice = async () => {
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "void" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "Update failed.", "danger");
      return;
    }
    toast(`${invoice.number} voided`, "success");
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

  const copyPayLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/portal/invoices?invoice=${invoice.id}`);
      toast("Payment link copied", "success");
    } catch {
      toast("Could not copy the link.", "danger");
    }
  };

  const openPrint = () => window.open(`/billing/${invoice.id}/print`, "_blank");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Pane header — who owes what, and every action */}
      <div className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Avatar name={invoice.clientName} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[17px] font-semibold text-text">
              {invoice.clientName}
              <InvoiceStatusBadge status={invoice.status} />
            </p>
            <p className="text-[13px] text-text-muted">
              {invoice.number}
              {invoice.issuedOn ? ` · issued ${dateOnly(invoice.issuedOn)}` : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
              {collectable ? "Balance due" : "Total"}
            </p>
            <p className={`text-[19px] font-bold sm:text-[22px] ${invoice.status === "paid" ? "text-success" : "text-text"}`}>
              {formatCents(collectable ? invoice.balanceCents : invoice.totalCents)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {collectable && (
            <>
              <Button size="sm" leftIcon="send" onClick={() => setSendOpen(true)}>
                {invoice.status === "draft" ? "Send invoice" : "Send again"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon="dollar"
                onClick={() =>
                  setPaymentTarget({ id: invoice.id, number: invoice.number, balanceCents: invoice.balanceCents })
                }
              >
                Record payment
              </Button>
              <Button size="sm" variant="secondary" leftIcon="credit-card" loading={collecting} onClick={collectOnline}>
                Collect online
              </Button>
            </>
          )}
          {!collectable && (
            <Button size="sm" variant="secondary" leftIcon="file-text" onClick={openPrint}>
              Print / PDF
            </Button>
          )}
          <div className="ml-auto">
            <KebabMenu>
              {collectable && <MenuItem icon="file-text" label="Print / PDF" onClick={openPrint} />}
              {collectable && <MenuItem icon="link" label="Copy pay link" onClick={copyPayLink} />}
              {open && <MenuItem icon="x" danger label="Void invoice" onClick={voidInvoice} />}
            </KebabMenu>
          </div>
        </div>
      </div>

      {/* Document body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
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
            No Stripe key is configured, so online payments simulate a successful checkout. Add{" "}
            <code className="font-mono text-[13px]">STRIPE_SECRET_KEY</code> and the same buttons run real Stripe
            Checkout.
          </Banner>
        )}

        {/* The “paper” — mirrors /billing/[id]/print */}
        <div className="rounded-card border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-text-muted">Bill to</p>
              <p className="mt-1 text-[15px] font-semibold text-text">{invoice.clientName}</p>
              {invoice.client?.email && <p className="text-[14px] text-text-body">{invoice.client.email}</p>}
            </div>
            <dl className="flex gap-6 text-right">
              {invoice.issuedOn && (
                <div>
                  <dt className="text-[12px] font-medium uppercase tracking-wide text-text-muted">Issued</dt>
                  <dd className="text-[14px] text-text">{dateOnly(invoice.issuedOn)}</dd>
                </div>
              )}
              {invoice.dueOn && (
                <div>
                  <dt className="text-[12px] font-medium uppercase tracking-wide text-text-muted">Due</dt>
                  <dd
                    className={`text-[14px] ${invoice.status === "overdue" ? "font-medium text-danger" : "text-text"}`}
                  >
                    {dateOnly(invoice.dueOn)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <table className="mt-5 w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-text/80">
                <th className="py-2 pr-4 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                  Description
                </th>
                <th className="py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it) => (
                <tr key={it.id} className="border-b border-border text-[15px] text-text-body">
                  <td className="py-2.5 pr-4">
                    {it.description}
                    {it.qty > 1 && (
                      <span className="ml-1.5 text-[13px] text-text-muted">
                        × {it.qty} at {formatCents(it.unitCents)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right font-medium text-text">
                    {formatCents(it.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <dl className="w-full max-w-[250px] space-y-1.5 text-[15px]">
              <div className="flex justify-between text-text-body">
                <dt>Subtotal</dt>
                <dd>{formatCents(invoice.subtotalCents)}</dd>
              </div>
              {invoice.taxCents > 0 && (
                <div className="flex justify-between text-text-body">
                  <dt>Tax</dt>
                  <dd>{formatCents(invoice.taxCents)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-text">
                <dt>Total</dt>
                <dd>{formatCents(invoice.totalCents)}</dd>
              </div>
              {invoice.paidCents > 0 && (
                <div className="flex justify-between text-text-body">
                  <dt>Paid</dt>
                  <dd>−{formatCents(invoice.paidCents)}</dd>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <dt className="text-text">Balance due</dt>
                <dd className={invoice.balanceCents > 0 && open ? "text-danger" : "text-success"}>
                  {formatCents(invoice.balanceCents)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Payments */}
        <h2 className="mb-3 mt-6 text-[17px] font-semibold text-text">Payments</h2>
        {invoice.payments.length === 0 ? (
          <p className="text-[15px] text-text-muted">
            No payments yet{collectable ? " — send the invoice or share the pay link to collect." : "."}
          </p>
        ) : (
          <ul className="space-y-2">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-field border border-border px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-success-tint text-success">
                  <Icon name="circle-check" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-text">
                    {METHOD_LABEL[p.method] ?? p.method} payment
                  </span>
                  <span className="block truncate text-[13px] text-text-muted">
                    {formatDateTime(p.paidAt)}
                    {p.stripePaymentIntent ? ` · ${p.stripePaymentIntent}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-semibold text-text">{formatCents(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <RecordPaymentModal
        invoice={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onRecorded={() => router.refresh()}
      />
      <SendInvoiceModal invoice={invoice} open={sendOpen} onClose={() => setSendOpen(false)} />
    </div>
  );
}

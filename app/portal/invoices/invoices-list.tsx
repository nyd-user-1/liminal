"use client";

import { useEffect, useState } from "react";
import { PortalInvoiceSheet, PORTAL_STATUS, type PortalInvoice } from "@/components/billing/portal-invoice-sheet";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Td, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate } from "@/lib/format";

// Portal Invoices — the provider Billing shell from a client's point of view:
// page-level Tabs (Overview / Unpaid / Paid) over one bordered container. The
// Overview tab carries the client's own numbers (balance, last payment) in the
// KPI spot; the list tabs open the self-contained PortalInvoiceSheet so paying
// never leaves this screen. ?invoice=<id> auto-opens a sheet (invoice emails /
// pay links); ?paid=1 / ?canceled=1 land back from a live Stripe redirect.

const dateOnly = (d: string) => formatDate(`${d}T00:00:00`);
const isSettled = (s: PortalInvoice["status"]) => s === "paid" || s === "void";
const METHOD_LABEL: Record<string, string> = { card: "Card", cash: "Cash", insurance: "Insurance", other: "Other" };

export function InvoicesList({
  invoices,
  stripeLive,
  clientEmail,
}: {
  invoices: PortalInvoice[];
  stripeLive: boolean;
  clientEmail: string | null;
}) {
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "unpaid" | "paid">("overview");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") toast("Payment received — thank you!", "success");
    if (params.get("canceled") === "1") toast("Checkout canceled — no payment was taken.", "warning");
    const wanted = params.get("invoice");
    if (wanted && invoices.some((i) => i.id === wanted)) setOpenId(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outstanding = invoices.reduce(
    (sum, i) => sum + (i.status === "sent" || i.status === "overdue" ? i.balanceCents : 0),
    0,
  );
  const lastPayment =
    invoices.flatMap((i) => i.payments).sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0] ?? null;
  const openInvoice = invoices.find((i) => i.id === openId) ?? null;

  const unpaid = invoices.filter((i) => !isSettled(i.status));
  const paid = invoices.filter((i) => isSettled(i.status));
  const visible = tab === "paid" ? paid : unpaid;

  const currentYear = new Date().getFullYear();
  const paidThisYear = invoices
    .flatMap((i) => i.payments)
    .filter((p) => new Date(p.paidAt).getFullYear() === currentYear)
    .reduce((sum, p) => sum + p.amountCents, 0);
  // Flat payment ledger (newest first), each tagged with its invoice so a row
  // can open that invoice's sheet.
  const allPayments = invoices
    .flatMap((i) => i.payments.map((p) => ({ ...p, invoiceNumber: i.number, invoiceId: i.id })))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  // Soonest-due unpaid invoice — drives the "next payment due" callout.
  const nextDue = unpaid.filter((i) => i.dueOn).sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : 1))[0] ?? null;

  if (invoices.length === 0) {
    return (
      <EmptyState icon="credit-card" title="No invoices yet" subtext="Invoices from your practice will appear here." />
    );
  }

  const invoiceRow = (inv: PortalInvoice) => {
    const s = PORTAL_STATUS[inv.status];
    const payable = inv.balanceCents > 0 && (inv.status === "sent" || inv.status === "overdue");
    return (
      <button
        key={inv.id}
        type="button"
        onClick={() => setOpenId(inv.id)}
        className="block w-full rounded-field px-2.5 py-2 text-left transition-colors hover:bg-canvas"
      >
        <span className="flex items-center gap-2.5">
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">{inv.number}</span>
          <span className="shrink-0 text-[15px] font-semibold text-text">
            {formatCents(payable ? inv.balanceCents : inv.totalCents)}
          </span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-[13px] text-text-muted">
            {inv.issuedOn ? `Issued ${dateOnly(inv.issuedOn)}` : "Not issued"}
            {inv.dueOn ? ` · Due ${dateOnly(inv.dueOn)}` : ""}
          </span>
          <Badge variant={s.variant}>{s.label}</Badge>
        </span>
      </button>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        className="mb-4 shrink-0"
        items={[
          { key: "overview", label: "Overview" },
          { key: "unpaid", label: "Unpaid", count: unpaid.length },
          { key: "paid", label: "Paid", count: paid.length },
        ]}
        active={tab}
        onChange={(k) => setTab(k as "overview" | "unpaid" | "paid")}
      />

      {tab === "overview" ? (
        <div className="no-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Outstanding balance" value={formatCents(outstanding)} />
            <StatCard label="Open invoices" value={unpaid.length} />
            <StatCard label={`Paid in ${currentYear}`} value={formatCents(paidThisYear)} />
            <StatCard
              label="Last payment"
              value={lastPayment ? formatCents(lastPayment.amountCents) : "—"}
              corner={
                lastPayment ? <span className="text-sm text-text-muted">{formatDate(lastPayment.paidAt)}</span> : undefined
              }
            />
          </div>

          {nextDue && (
            <Banner
              variant={nextDue.status === "overdue" ? "warning" : "info"}
              action={
                <Button size="sm" onClick={() => setOpenId(nextDue.id)}>
                  {nextDue.balanceCents > 0 && (nextDue.status === "sent" || nextDue.status === "overdue")
                    ? "Pay now"
                    : "View"}
                </Button>
              }
            >
              {nextDue.status === "overdue" ? "Payment overdue — " : "Next payment due — "}
              <span className="font-semibold">{formatCents(nextDue.balanceCents)}</span> on {nextDue.number}
              {nextDue.dueOn ? `, due ${dateOnly(nextDue.dueOn)}` : ""}.
            </Banner>
          )}

          <div>
            <h2 className="mb-3 text-[15px] font-semibold text-text">Payment history</h2>
            {allPayments.length === 0 ? (
              <div className="rounded-card border border-border bg-surface shadow-card">
                <EmptyState icon="credit-card" title="No payments yet" subtext="Your payments will appear here." />
              </div>
            ) : (
              <Table head={["Date", "Method", "Invoice", "Amount"]}>
                {allPayments.map((p) => (
                  <Tr key={p.id} onClick={() => setOpenId(p.invoiceId)}>
                    <Td className="whitespace-nowrap text-text-muted">{formatDate(p.paidAt)}</Td>
                    <Td>{METHOD_LABEL[p.method] ?? p.method}</Td>
                    <Td className="font-medium text-text">{p.invoiceNumber}</Td>
                    <Td className="whitespace-nowrap font-semibold">{formatCents(p.amountCents)}</Td>
                  </Tr>
                ))}
              </Table>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {visible.length === 0 ? (
              <EmptyState
                icon="credit-card"
                title={tab === "unpaid" ? "Nothing due" : "No paid invoices yet"}
                subtext={tab === "unpaid" ? "You're all caught up." : "Paid and closed invoices land here."}
              />
            ) : (
              <div className="space-y-0.5">{visible.map(invoiceRow)}</div>
            )}
          </div>
          <div className="shrink-0 border-t border-border px-4 py-3 text-[13px] font-medium text-text-muted">
            {visible.length} {visible.length === 1 ? "invoice" : "invoices"}
          </div>
        </div>
      )}

      <PortalInvoiceSheet
        invoice={openInvoice}
        onClose={() => setOpenId(null)}
        stripeLive={stripeLive}
        clientEmail={clientEmail}
      />
    </div>
  );
}

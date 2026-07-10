"use client";

import { useEffect, useState } from "react";
import { PortalInvoiceSheet, PORTAL_STATUS, type PortalInvoice } from "@/components/billing/portal-invoice-sheet";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, IconSquare } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate } from "@/lib/format";

// Portal invoice list — outstanding-balance summary + rows that open the
// self-contained PortalInvoiceSheet (view · pay · receipt), so paying never
// leaves this screen. ?invoice=<id> (invoice emails / shared pay links)
// auto-opens that invoice's sheet; ?paid=1 / ?canceled=1 land back from a
// live Stripe redirect.

const dateOnly = (d: string) => formatDate(`${d}T00:00:00`);

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

  if (invoices.length === 0) {
    return (
      <EmptyState icon="credit-card" title="No invoices yet" subtext="Invoices from your practice will appear here." />
    );
  }

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4">
        <StatCard label="Outstanding balance" value={formatCents(outstanding)} />
        <StatCard
          label="Last payment"
          value={lastPayment ? formatCents(lastPayment.amountCents) : "—"}
          corner={
            lastPayment ? <span className="text-sm text-text-muted">{formatDate(lastPayment.paidAt)}</span> : undefined
          }
        />
      </div>

      <div className="space-y-2.5">
        {invoices.map((inv) => {
          const s = PORTAL_STATUS[inv.status];
          const payable = inv.balanceCents > 0 && (inv.status === "sent" || inv.status === "overdue");
          return (
            <ListRow
              key={inv.id}
              onClick={() => setOpenId(inv.id)}
              leading={<IconSquare name="credit-card" />}
              title={
                <>
                  {inv.number}
                  <Badge variant={s.variant}>{s.label}</Badge>
                </>
              }
              meta={
                <>
                  {inv.issuedOn ? `Issued ${dateOnly(inv.issuedOn)}` : "Not issued"}
                  {inv.dueOn ? ` · Due ${dateOnly(inv.dueOn)}` : ""}
                </>
              }
              trailing={
                <>
                  <span className="text-[15px] font-semibold text-text">
                    {formatCents(payable ? inv.balanceCents : inv.totalCents)}
                  </span>
                  <Icon name="chevron-right" size={16} className="text-text-muted" />
                </>
              }
            />
          );
        })}
      </div>

      <PortalInvoiceSheet
        invoice={openInvoice}
        onClose={() => setOpenId(null)}
        stripeLive={stripeLive}
        clientEmail={clientEmail}
      />
    </>
  );
}

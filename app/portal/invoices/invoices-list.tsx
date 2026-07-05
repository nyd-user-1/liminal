"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSquare } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/types";

interface InvoiceItem {
  id: string;
  number: string;
  status: InvoiceStatus;
  issuedOn: string | null;
  dueOn: string | null;
  totalCents: number;
  balanceCents: number;
}

const STATUS: Record<InvoiceStatus, { label: string; variant: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  draft: { label: "Draft", variant: "neutral" },
  sent: { label: "Due", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  overdue: { label: "Overdue", variant: "danger" },
  void: { label: "Void", variant: "neutral" },
};

export function InvoicesList({ invoices }: { invoices: InvoiceItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [payingId, setPayingId] = useState<string | null>(null);

  // Landing back from a (live) checkout redirect.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("paid") === "1") {
      toast("Payment received — thank you!", "success");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pay = async (invoice: InvoiceItem) => {
    setPayingId(invoice.id);
    const res = await fetch(`/portal/invoices/${invoice.id}/pay`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setPayingId(null);
      toast(data?.error ?? "Could not start the payment.", "danger");
      return;
    }
    if (data?.url) {
      window.location.assign(data.url); // live Stripe Checkout
      return;
    }
    setPayingId(null);
    toast(`${invoice.number} paid — thank you!`, "success");
    router.refresh();
  };

  if (invoices.length === 0) {
    return <EmptyState icon="credit-card" title="No invoices yet" subtext="Invoices from your practice will appear here." />;
  }

  return (
    <div className="space-y-2.5">
      {invoices.map((inv) => {
        const s = STATUS[inv.status];
        const payable = inv.balanceCents > 0 && (inv.status === "sent" || inv.status === "overdue");
        return (
          <ListRow
            key={inv.id}
            leading={<IconSquare name="credit-card" />}
            title={
              <>
                {inv.number}
                <Badge variant={s.variant}>{s.label}</Badge>
              </>
            }
            meta={
              <>
                {inv.issuedOn ? `Issued ${formatDate(inv.issuedOn)}` : "Not issued"}
                {inv.dueOn ? ` · Due ${formatDate(inv.dueOn)}` : ""}
              </>
            }
            trailing={
              <>
                <span className="text-[15px] font-semibold text-text">{formatCents(inv.balanceCents > 0 ? inv.balanceCents : inv.totalCents)}</span>
                {payable && (
                  <Button size="sm" leftIcon="credit-card" loading={payingId === inv.id} onClick={() => pay(inv)}>
                    Pay
                  </Button>
                )}
              </>
            }
          />
        );
      })}
    </div>
  );
}

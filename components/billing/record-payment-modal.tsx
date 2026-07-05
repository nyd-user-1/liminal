"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatCents } from "@/lib/format";

// Record payment Modal — amount ($-prefixed, defaults to the open balance) +
// method Select. POSTs /api/payments; recordPayment flips the invoice to paid
// once the balance is covered.

export interface PaymentTarget {
  id: string;
  number: string;
  balanceCents: number;
}

const METHODS = [
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
];

export function RecordPaymentModal({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: PaymentTarget | null;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("card");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setAmount((invoice.balanceCents / 100).toFixed(2));
      setMethod("card");
      setError(undefined);
    }
  }, [invoice]);

  const submit = async () => {
    if (!invoice) return;
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, amountCents, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not record the payment.");
      toast(
        data.invoice?.status === "paid"
          ? `Payment recorded — ${invoice.number} is paid in full`
          : `Payment of ${formatCents(amountCents)} recorded on ${invoice.number}`,
        "success",
      );
      onClose();
      onRecorded();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not record the payment.", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!invoice}
      onClose={onClose}
      title="Record payment"
      icon="dollar"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Record payment
          </Button>
        </>
      }
    >
      {invoice && (
        <div className="space-y-4">
          <p className="text-[15px] text-text-muted">
            {invoice.number} · balance <span className="font-semibold text-text">{formatCents(invoice.balanceCents)}</span>
          </p>
          <Field
            label="Amount"
            required
            prefix="$"
            inputMode="decimal"
            value={amount}
            error={error}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(undefined);
            }}
          />
          <Select label="Method" options={METHODS} value={method} onValueChange={setMethod} />
        </div>
      )}
    </Modal>
  );
}

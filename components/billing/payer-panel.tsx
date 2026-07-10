"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SidePanel } from "@/components/ui/side-panel";
import { useToast } from "@/components/ui/toast";

// New / edit payer SidePanel — name + payer ID (per the Billing design note's
// payer rows: code + name).

export function PayerPanel({
  open,
  onClose,
  payer,
}: {
  open: boolean;
  onClose: () => void;
  payer: { id: string; name: string; payerCode: string } | null; // null = create
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [payerCode, setPayerCode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(payer?.name ?? "");
      setPayerCode(payer?.payerCode ?? "");
    }
  }, [open, payer]);

  const submit = async () => {
    if (!name.trim() || !payerCode.trim()) {
      toast("Name and payer ID are both required.", "warning");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(payer ? `/api/payers/${payer.id}` : "/api/payers", {
        method: payer ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), payerCode: payerCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save the payer.");
      toast(payer ? "Payer updated" : `${name.trim()} added`, "success");
      onClose();
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the payer.", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={payer ? "Edit payer" : "New payer"}
      icon="shield-plus"
      mobileSheet
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {payer ? "Save" : "Add payer"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Payer name" required placeholder="E.g. Aetna" value={name} onChange={(e) => setName(e.target.value)} />
        <Field
          label="Payer ID"
          required
          placeholder="E.g. 60054"
          hint="The electronic payer ID used on claims."
          value={payerCode}
          onChange={(e) => setPayerCode(e.target.value)}
        />
      </div>
    </SidePanel>
  );
}

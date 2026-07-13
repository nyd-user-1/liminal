"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { titleCase } from "@/lib/format";
import type { DirectoryProgram, DirectoryProvider } from "@/lib/types";

// Shared "Refer a client" dialog — POSTs to /api/directory/referrals. Used by
// the Directory table's SidePanel (programs, and provider rows with no NPI)
// and by the provider profile page's page-level action (provider rows with
// an NPI, which route straight past the SidePanel now).

export function ReferModal({
  open,
  onClose,
  clients,
  target,
  isProvider,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  clients: Array<{ id: string; name: string }>;
  target: DirectoryProvider | DirectoryProgram;
  isProvider: boolean;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [clientId, setClientId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const targetName = isProvider
    ? titleCase((target as DirectoryProvider).name)
    : (target as DirectoryProgram).programName;

  async function submit() {
    if (!clientId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/directory/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          providerId: isProvider ? target.id : null,
          programId: isProvider ? null : target.id,
          reason,
        }),
      });
      if (!res.ok) throw new Error();
      setClientId("");
      setReason("");
      onSuccess();
    } catch {
      toast("Could not create referral.", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="send"
      title="Refer a client"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!clientId}>
            Send referral
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-body">
          Referring to <span className="font-medium text-text">{targetName}</span>.
        </p>
        <Select
          label="Client"
          required
          searchable
          placeholder="Select a client…"
          value={clientId}
          onValueChange={setClientId}
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Textarea
          label="Reason for referral"
          rows={4}
          placeholder="Why this provider or program is a good fit…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}

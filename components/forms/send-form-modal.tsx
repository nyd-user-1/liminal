"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

// "Send to client" modal (Carepatron send-intake flow, single-step): pick a
// client → POST /api/forms/[id]/send → form_response (sent) + thread message
// with the portal link.

export function SendFormModal({
  open,
  onClose,
  formId,
  formTitle,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  clients: Array<{ id: string; name: string }>;
}) {
  const toast = useToast();
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!clientId) {
      toast("Choose a client first.", "warning");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/forms/${formId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast(data?.error ?? "Could not send the form.", "danger");
      return;
    }
    const name = clients.find((c) => c.id === clientId)?.name ?? "the client";
    toast(`"${formTitle}" sent to ${name} — a portal link was added to their messages.`, "success");
    setClientId("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Send "${formTitle}"`}
      icon="send"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} loading={busy}>
            Send form
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[15px] text-text-body">
        The client gets a secure-message link to complete this form in their portal.
      </p>
      <Select
        label="Client"
        required
        placeholder="Choose a client"
        options={clients.map((c) => ({ value: c.id, label: c.name }))}
        value={clientId}
        onValueChange={setClientId}
      />
    </Modal>
  );
}

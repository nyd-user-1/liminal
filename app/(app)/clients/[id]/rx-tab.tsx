"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Table, Td, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { PrescribePanel } from "@/components/photon/prescribe-panel";
import { formatDate } from "@/lib/format";
import type { Client } from "@/lib/types";

// Rx tab — real Photon data, no fixtures. Reads go through the server's M2M
// token (/api/photon/prescriptions); writes go through the provider's own
// Photon login inside PrescribePanel, because M2M cannot write prescriptions.

type Prescription = {
  id: string;
  medication: string;
  dispenseQuantity: number | null;
  dispenseUnit: string | null;
  fillsAllowed: number | null;
  writtenAt: string | null;
  state: "ACTIVE" | "EXPIRED" | "DEPLETED" | "CANCELED";
};

const STATE_VARIANT: Record<Prescription["state"], "success" | "neutral" | "warning" | "danger"> = {
  ACTIVE: "success",
  EXPIRED: "neutral",
  DEPLETED: "warning",
  CANCELED: "danger",
};

const STATE_LABEL: Record<Prescription["state"], string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  DEPLETED: "Depleted",
  CANCELED: "Canceled",
};

export function RxTab({
  client,
  photonClientId,
  orgId,
  photonEnv,
}: {
  client: Client;
  photonClientId: string;
  /** Photon org id, read server-side off the M2M token. Empty = Photon unconfigured. */
  orgId: string;
  photonEnv: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<Prescription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const patientId = client.photonPatientId;

  const load = useCallback(async () => {
    if (!patientId) return;
    setError(null);
    try {
      const res = await fetch(`/api/photon/prescriptions?patientId=${encodeURIComponent(patientId)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not load prescriptions from Photon.");
        setRows([]);
        return;
      }
      setRows(json.prescriptions ?? []);
    } catch {
      setError("Could not reach Photon.");
      setRows([]);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/photon/sync-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json?.error ?? "Could not sync this client to Photon.", "danger");
        return;
      }
      toast("Synced to Photon.", "success");
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  const canConfigure = !!photonClientId && !!orgId;

  if (!patientId) {
    return (
      <div className="rounded-card border border-border bg-surface shadow-card">
        <EmptyState
          icon="pill-bottle"
          title="Not synced to Photon"
          subtext="This client needs a Photon patient record before prescriptions can be read or written."
          actions={
            <Button leftIcon="file-up" onClick={sync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync to Photon"}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <Button
          leftIcon="plus"
          onClick={() => setPanelOpen(true)}
          disabled={!canConfigure}
          title={canConfigure ? undefined : "Photon is not configured on this server."}
        >
          Create prescription
        </Button>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-border bg-surface shadow-card">
          <EmptyState
            icon="pill-bottle"
            title={error ? "Could not load prescriptions" : "No prescriptions yet"}
            subtext={error ?? "Prescriptions written through Photon appear here."}
          />
        </div>
      ) : (
        <Table head={["Medication", "Quantity", "Fills", "Written", "Status"]}>
          {rows.map((rx) => (
            <Tr key={rx.id}>
              <Td className="font-medium">{rx.medication}</Td>
              <Td className="whitespace-nowrap tabular-nums">
                {rx.dispenseQuantity ?? "–"}
                {rx.dispenseUnit ? ` ${rx.dispenseUnit}` : ""}
              </Td>
              <Td className="tabular-nums">{rx.fillsAllowed ?? "–"}</Td>
              <Td className="whitespace-nowrap text-text-muted">{rx.writtenAt ? formatDate(rx.writtenAt) : "–"}</Td>
              <Td>
                <Badge variant={STATE_VARIANT[rx.state]}>{STATE_LABEL[rx.state]}</Badge>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      {canConfigure && (
        <PrescribePanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          onCreated={() => {
            toast("Prescription sent to Photon.", "success");
            void load();
          }}
          patientId={patientId}
          clientName={`${client.firstName} ${client.lastName}`}
          photonClientId={photonClientId}
          orgId={orgId}
          photonEnv={photonEnv}
        />
      )}
    </>
  );
}

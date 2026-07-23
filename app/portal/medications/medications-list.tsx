"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Table, Td, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { PharmacyPicker } from "@/components/photon/pharmacy-picker";
import { RxDetailPanel } from "@/components/photon/rx-detail-panel";
import { ORDER_STATE_LABEL, ORDER_STATE_VARIANT, RX_STATE_LABEL, RX_STATE_VARIANT } from "@/components/photon/status";
import { formatDate } from "@/lib/format";
import type { PhotonOrder, PhotonPharmacy, PhotonPrescription } from "@/lib/photon";

// Patient-facing medications view. Same read-only detail panel the provider
// sees (audience="patient" only changes the pharmacy wording), plus the two
// things a patient actually acts on: where their order is, and which pharmacy
// it should go to.

export function MedicationsList({
  prescriptions,
  orders,
  preferred: initialPreferred,
}: {
  prescriptions: PhotonPrescription[];
  orders: PhotonOrder[];
  preferred: PhotonPharmacy[];
}) {
  const toast = useToast();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Standard anatomy: select columns (nothing consumes the selections yet).
  const [rxSel, setRxSel] = useState<Set<string>>(new Set());
  const [orderSel, setOrderSel] = useState<Set<string>>(new Set());
  const toggleIn = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const stdFooter = (n: number) => (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-text-muted">
      <span className="min-w-0 truncate tabular-nums">{n.toLocaleString("en-US")} records</span>
      <span className="shrink-0">Data set by NYSgpt</span>
    </div>
  );
  const [preferred, setPreferred] = useState(initialPreferred);
  const [removing, setRemoving] = useState(false);

  // "Pending selection" is the state Photon leaves an order in until the
  // patient picks a pharmacy (usually by replying to Photon's text message).
  const awaitingPharmacy = orders.some((o) => !o.pharmacy && (o.state === "ROUTING" || o.state === "PENDING"));
  const pharmacy = preferred[0] ?? null;

  async function removePreferred() {
    if (!pharmacy) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/portal/pharmacy?pharmacyId=${encodeURIComponent(pharmacy.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast(json?.error ?? "Could not remove your pharmacy.", "danger");
        return;
      }
      setPreferred(json.pharmacies ?? []);
      toast("Preferred pharmacy removed.", "success");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-text">Your pharmacy</h2>
            {pharmacy ? (
              <>
                <p className="mt-1 font-medium text-text">{pharmacy.name}</p>
                {pharmacy.address && <p className="text-[13px] text-text-muted">{pharmacy.address}</p>}
              </>
            ) : (
              <p className="mt-1 max-w-prose text-[15px] text-text-muted">
                You haven&rsquo;t chosen a preferred pharmacy yet.
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {pharmacy && (
              <Button variant="secondary" onClick={removePreferred} disabled={removing}>
                {removing ? "Removing…" : "Remove"}
              </Button>
            )}
            <Button leftIcon={pharmacy ? "edit" : "plus"} onClick={() => setPickerOpen(true)}>
              {pharmacy ? "Change" : "Choose a pharmacy"}
            </Button>
          </div>
        </div>
        {awaitingPharmacy && (
          <p className="mt-4 max-w-prose rounded-field bg-info-tint px-3 py-2 text-[15px] text-info">
            Your pharmacy choice is pending — check your text messages from Photon, or a preferred pharmacy will be used
            automatically.
          </p>
        )}
      </Card>

      <section>
        <h2 className="mb-3 text-[17px] font-semibold text-text">Medications</h2>
        {prescriptions.length === 0 ? (
          <div className="rounded-card border border-border bg-surface shadow-card">
            <EmptyState
              icon="pill-bottle"
              title="No medications yet"
              subtext="Prescriptions your care team writes for you will appear here."
            />
          </div>
        ) : (
          <Table
            footer={stdFooter(prescriptions.length)}
            head={[
              <Checkbox
                key="__sel"
                aria-label="Select all"
                checked={prescriptions.every((rx) => rxSel.has(rx.id))}
                onChange={() =>
                  setRxSel((prev) => {
                    const all = prescriptions.every((rx) => prev.has(rx.id));
                    const next = new Set(prev);
                    prescriptions.forEach((rx) => (all ? next.delete(rx.id) : next.add(rx.id)));
                    return next;
                  })
                }
              />,
              "Medication",
              "Instructions",
              "Written",
              "Status",
              "",
            ]}
          >
            {prescriptions.map((rx) => (
              <Tr key={rx.id} onClick={() => setDetailId(rx.id)}>
                <Td className="w-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label="Select row" checked={rxSel.has(rx.id)} onChange={() => toggleIn(setRxSel)(rx.id)} />
                </Td>
                <Td className="font-medium">{rx.medication}</Td>
                <Td className="max-w-72 truncate" title={rx.instructions ?? undefined}>
                  {rx.instructions ?? "–"}
                </Td>
                <Td className="whitespace-nowrap text-text-muted">{rx.writtenAt ? formatDate(rx.writtenAt) : "–"}</Td>
                <Td>
                  <Badge variant={RX_STATE_VARIANT[rx.state]}>{RX_STATE_LABEL[rx.state]}</Badge>
                </Td>
                <Td className="w-12" onClick={(e) => e.stopPropagation()}>
                  <KebabMenu label={`Actions for ${rx.medication}`}>
                    <MenuItem icon="eye" label="View details" onClick={() => setDetailId(rx.id)} />
                  </KebabMenu>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </section>

      {orders.length > 0 && (
        <section>
          <h2 className="mb-3 text-[17px] font-semibold text-text">Orders</h2>
          <Table
            footer={stdFooter(orders.length)}
            head={[
              <Checkbox
                key="__sel"
                aria-label="Select all"
                checked={orders.every((o) => orderSel.has(o.id))}
                onChange={() =>
                  setOrderSel((prev) => {
                    const all = orders.every((o) => prev.has(o.id));
                    const next = new Set(prev);
                    orders.forEach((o) => (all ? next.delete(o.id) : next.add(o.id)));
                    return next;
                  })
                }
              />,
              "Medication",
              "Status",
              "Pharmacy",
              "Created",
              "",
            ]}
          >
            {orders.map((o) => (
              <Tr key={o.id}>
                <Td className="w-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label="Select row" checked={orderSel.has(o.id)} onChange={() => toggleIn(setOrderSel)(o.id)} />
                </Td>
                <Td className="max-w-72 truncate" title={o.medications.join(", ")}>
                  {o.medications.join(", ") || "–"}
                </Td>
                <Td>
                  <Badge variant={ORDER_STATE_VARIANT[o.state]}>{ORDER_STATE_LABEL[o.state]}</Badge>
                </Td>
                <Td>
                  {o.pharmacy ? (
                    o.pharmacy.name
                  ) : (
                    <span className="italic text-text-muted">Pending selection</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-text-muted">{o.createdAt ? formatDate(o.createdAt) : "–"}</Td>
                <Td className="w-12" onClick={(e) => e.stopPropagation()}>
                  <KebabMenu label="Order actions">
                    <MenuItem
                      icon="copy"
                      label="Copy medication list"
                      onClick={() => {
                        void navigator.clipboard.writeText(o.medications.join(", "));
                        toast("Medication list copied.", "success");
                      }}
                    />
                  </KebabMenu>
                </Td>
              </Tr>
            ))}
          </Table>
        </section>
      )}

      <RxDetailPanel prescriptionId={detailId} onClose={() => setDetailId(null)} audience="patient" />
      <PharmacyPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelected={(list) => setPreferred(list)}
      />
    </div>
  );
}

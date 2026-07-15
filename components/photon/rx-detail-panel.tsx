"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Divider } from "@/components/ui/divider";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { ORDER_STATE_LABEL, ORDER_STATE_VARIANT, RX_STATE_LABEL, RX_STATE_VARIANT, quantityLabel } from "@/components/photon/status";
import { SidePanel } from "@/components/ui/side-panel";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PhotonRxDetail } from "@/lib/photon";

// Read-only prescription detail, mirroring Photon's own detail view. Shared by
// all four surfaces that drill into an Rx row — the client Rx tab,
// /prescriptions, /orders and the patient portal — so the portal shows exactly
// what the provider sees. Reads /api/photon/prescription, which decides for
// itself whether the caller may see that row (lib/photon-scope.ts); nothing
// here is trusted to scope anything.
//
// No cancel/renew actions: those are prescription WRITES, which the M2M token
// cannot do at all (see docs/reports/2026-07-14-photon-demo.md).

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 py-2">
      <dt className="w-40 shrink-0 text-[13px] text-text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-[15px] text-text">{children}</dd>
    </div>
  );
}

/** Em-dash for anything Photon left null, so an empty field reads as "known to be empty". */
function val(v: string | number | null | undefined): ReactNode {
  return v === null || v === undefined || v === "" ? <span className="text-text-muted">–</span> : v;
}

export function RxDetailPanel({
  prescriptionId,
  onClose,
  /** Portal wording differs from the provider's — see the pharmacy line below. */
  audience = "provider",
}: {
  prescriptionId: string | null;
  onClose: () => void;
  audience?: "provider" | "patient";
}) {
  const [rx, setRx] = useState<PhotonRxDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setRx(null);
    setError(null);
    try {
      const res = await fetch(`/api/photon/prescription?id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not load this prescription.");
        return;
      }
      setRx(json.prescription);
    } catch {
      setError("Could not reach Photon.");
    }
  }, []);

  useEffect(() => {
    if (prescriptionId) void load(prescriptionId);
  }, [prescriptionId, load]);

  return (
    <SidePanel open={!!prescriptionId} onClose={onClose} title="Prescription" icon="pill-bottle" width="max-w-2xl" mobileSheet>
      {error ? (
        <EmptyState icon="pill-bottle" title="Could not load prescription" subtext={error} />
      ) : !rx ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="min-w-0 text-[17px] font-semibold text-text">{rx.medication}</h3>
            <Badge variant={RX_STATE_VARIANT[rx.state]}>{RX_STATE_LABEL[rx.state]}</Badge>
          </div>

          <dl className="mt-4 divide-y divide-border">
            <Row label="Patient">{val(rx.patientName)}</Row>
            <Row label="Written">{rx.writtenAt ? formatDateTime(rx.writtenAt) : val(null)}</Row>
            <Row label="Prescriber">{val(rx.prescriberName)}</Row>
            <Row label="Instructions">{val(rx.instructions)}</Row>
            <Row label="Pharmacy notes">{val(rx.notes)}</Row>
            <Row label="Quantity">{quantityLabel(rx.dispenseQuantity, rx.dispenseUnit, rx.daysSupply)}</Row>
            <Row label="Fills">
              {rx.fillsRemaining ?? "–"} of {rx.fillsAllowed ?? "–"} remaining
            </Row>
            <Row label="Effective">{rx.effectiveDate ? formatDate(rx.effectiveDate) : val(null)}</Row>
            <Row label="Do not fill before">{rx.doNotFillBeforeDate ? formatDate(rx.doNotFillBeforeDate) : val(null)}</Row>
            <Row label="Expires">{rx.expirationDate ? formatDate(rx.expirationDate) : val(null)}</Row>
            <Row label="Dispense as written">{rx.dispenseAsWritten === null ? val(null) : rx.dispenseAsWritten ? "Yes" : "No"}</Row>
            <Row label="External ID">{val(rx.externalId)}</Row>
          </dl>

          <Divider className="my-5" />

          <h4 className="text-[15px] font-semibold text-text">Pharmacy orders</h4>
          {rx.orders.length === 0 ? (
            <p className="mt-2 text-[15px] text-text-muted">No pharmacy order has been created for this prescription yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {rx.orders.map((o) => (
                <li key={o.id} className="rounded-card border border-border bg-canvas p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={ORDER_STATE_VARIANT[o.state]}>{ORDER_STATE_LABEL[o.state]}</Badge>
                    <span className="text-[13px] text-text-muted">
                      {o.createdAt ? `Created ${formatDateTime(o.createdAt)}` : "Created –"}
                    </span>
                  </div>
                  <dl className="mt-2 divide-y divide-border">
                    <Row label="Pharmacy">
                      {o.pharmacy ? (
                        <>
                          <span className="font-medium">{o.pharmacy.name}</span>
                          {o.pharmacy.address && <span className="block text-[13px] text-text-muted">{o.pharmacy.address}</span>}
                        </>
                      ) : o.state === "ROUTING" ? (
                        <span className="italic text-text-muted">
                          {audience === "patient"
                            ? "Pending selection — check your text messages from Photon, or a preferred pharmacy will be used automatically."
                            : "Pending selection — the patient has not chosen a pharmacy yet."}
                        </span>
                      ) : (
                        <span className="italic text-text-muted">Pending selection</span>
                      )}
                    </Row>
                    {/* An order batches a patient's fills, so it can span more than
                        one prescription — name the others rather than implying
                        this order is only about the Rx above. */}
                    {o.medications.length > 1 && <Row label="Also in this order">{o.medications.filter((m) => m !== rx.medication).join(", ")}</Row>}
                    <Row label="Fills">{o.fillCount}</Row>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SidePanel>
  );
}

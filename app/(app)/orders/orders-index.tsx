"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { TextLink } from "@/components/ui/text-link";
import { ORDER_STATE_LABEL, ORDER_STATE_VARIANT } from "@/components/photon/status";
import { RxDetailPanel } from "@/components/photon/rx-detail-panel";
import { formatDate } from "@/lib/format";
import type { PhotonOrder, PhotonOrderState } from "@/lib/photon";

export type Row = PhotonOrder & { clientId: string };

// Only the states this org actually produces get chips; the rest still render
// their badge if Photon returns them.
const STATES: PhotonOrderState[] = ["ROUTING", "PENDING", "PLACED", "COMPLETED", "CANCELED", "ERROR"];

export function OrdersIndex({ rows, truncated }: { rows: Row[]; truncated: boolean }) {
  const [term, setTerm] = useState("");
  const [states, setStates] = useState<Set<PhotonOrderState>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return rows.filter(
      (r) => (!q || r.patientName.toLowerCase().includes(q)) && (states.size === 0 || states.has(r.state)),
    );
  }, [rows, term, states]);

  const columns: DataTableColumn<Row>[] = [
    {
      key: "medication",
      label: "Medication",
      fixed: true,
      sortValue: (r) => r.medications[0] ?? "",
      cellClassName: "max-w-80 truncate",
      render: (r) => (
        <span className="font-medium" title={r.medications.join(", ")}>
          {r.medications.join(", ") || "–"}
        </span>
      ),
    },
    {
      key: "patient",
      label: "Patient",
      sortValue: (r) => r.patientName,
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <TextLink href={`/clients/${r.clientId}?tab=rx`}>{r.patientName}</TextLink>
        </span>
      ),
    },
    {
      key: "state",
      label: "Status",
      sortValue: (r) => r.state,
      render: (r) => <Badge variant={ORDER_STATE_VARIANT[r.state]}>{ORDER_STATE_LABEL[r.state]}</Badge>,
    },
    {
      key: "pharmacy",
      label: "Pharmacy",
      sortValue: (r) => r.pharmacy?.name ?? "",
      cellClassName: "max-w-64 truncate",
      render: (r) =>
        r.pharmacy ? (
          <span title={r.pharmacy.address ?? undefined}>{r.pharmacy.name}</span>
        ) : (
          <span className="italic text-text-muted">Pending selection</span>
        ),
    },
    {
      key: "fills",
      label: "Fills",
      defaultHidden: true,
      sortValue: (r) => r.fillCount,
      render: (r) => r.fillCount,
    },
    {
      key: "created",
      label: "Created",
      sortValue: (r) => r.createdAt ?? "",
      render: (r) => <span className="text-text-muted">{r.createdAt ? formatDate(r.createdAt) : "–"}</span>,
    },
  ];

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface shadow-card">
        <EmptyState
          icon="send"
          title="No pharmacy orders yet"
          subtext="When a prescription is sent to a pharmacy, its order appears here."
        />
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        storageKey="photon.orders.columns"
        // An order batches fills that can span prescriptions; the row drills
        // into the first one, and the panel names the others it covers.
        onRowClick={(r) => setDetailId(r.prescriptionIds[0] ?? null)}
        toolbarLeft={
          <>
            <SearchInput
              className="w-64"
              placeholder="Search by patient"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            {STATES.map((s) => (
              <ChoiceChip
                key={s}
                label={ORDER_STATE_LABEL[s]}
                selected={states.has(s)}
                onSelect={() =>
                  setStates((prev) => {
                    const next = new Set(prev);
                    if (next.has(s)) next.delete(s);
                    else next.add(s);
                    return next;
                  })
                }
              />
            ))}
          </>
        }
        footnote={
          truncated ? (
            <p className="text-[13px] text-text-muted">
              Showing the most recent orders only — this organisation has more than the per-query limit.
            </p>
          ) : undefined
        }
      />
      <RxDetailPanel prescriptionId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}

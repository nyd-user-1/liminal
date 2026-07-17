"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import { ChipMenu } from "@/components/rates/chip-menu";
import { RX_STATE_LABEL, RX_STATE_VARIANT, quantityLabel } from "@/components/photon/status";
import { RxDetailPanel } from "@/components/photon/rx-detail-panel";
import { inScope, type TableScope } from "@/components/tables/scope";
import { useLazyRows } from "@/components/tables/use-lazy-rows";
import { formatDate } from "@/lib/format";
import type { PhotonRxListRow, PhotonRxState } from "@/lib/photon";

// The prescriptions object table: everything from the search bar down, page
// chrome excluded. Mounted by /prescriptions (server-fetched rows) and by the
// Clients rail (no rows → it loads its own through the API twin).

export type PrescriptionRow = PhotonRxListRow & { clientId: string };

// Photon's DRAFT state exists in the schema but never reaches a list like this
// (a draft isn't a written prescription), so it gets no chip — if one ever
// shows up it still renders its badge, it just isn't filterable.
const STATES: PhotonRxState[] = ["ACTIVE", "DEPLETED", "EXPIRED", "CANCELED"];

export function PrescriptionsTable({
  rows: provided,
  truncated: providedTruncated = false,
  scope = "all",
  onRowOpen,
}: {
  /** Server-fetched rows, already role-scoped. Omit to load through the twin. */
  rows?: PrescriptionRow[];
  truncated?: boolean;
  scope?: TableScope;
  /** Overrides the built-in detail panel (the host drives the drill-down). */
  onRowOpen?: (row: PrescriptionRow) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [states, setStates] = useState<Set<PhotonRxState>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const lazy = useLazyRows<PrescriptionRow>("/api/photon/prescriptions/all", "prescriptions", provided === undefined);
  const rows = provided ?? lazy.rows;
  const truncated = provided ? providedTruncated : lazy.truncated;

  const filtered = useMemo(
    () =>
      (rows ?? []).filter((r) => {
        const q = term.trim().toLowerCase();
        return (
          inScope(scope, r) &&
          (!q || r.patientName.toLowerCase().includes(q)) &&
          (states.size === 0 || states.has(r.state))
        );
      }),
    [rows, term, states, scope],
  );

  const open = (r: PrescriptionRow) => (onRowOpen ? onRowOpen(r) : setDetailId(r.id));

  const columns: DataTableColumn<PrescriptionRow>[] = [
    {
      key: "medication",
      label: "Medication",
      fixed: true,
      sortValue: (r) => r.medication,
      cellClassName: "max-w-80",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium" title={r.medication}>
            {r.medication}
          </p>
          {r.instructions && (
            <p className="truncate text-[13px] text-text-muted" title={r.instructions}>
              {r.instructions}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "quantity",
      label: "Quantity",
      sortValue: (r) => r.dispenseQuantity ?? -1,
      render: (r) => quantityLabel(r.dispenseQuantity, r.dispenseUnit, null),
    },
    {
      key: "patient",
      label: "Patient",
      sortValue: (r) => r.patientName,
      // Stops the row's own drill-down from firing underneath the link.
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <TextLink href={`/clients/${r.clientId}?tab=rx`}>{r.patientName}</TextLink>
        </span>
      ),
    },
    {
      key: "fills",
      label: "Fills",
      sortValue: (r) => r.fillsRemaining ?? -1,
      render: (r) => `${r.fillsRemaining ?? "–"} of ${r.fillsAllowed ?? "–"}`,
    },
    {
      key: "status",
      label: "Status",
      sortValue: (r) => r.state,
      render: (r) => <Badge variant={RX_STATE_VARIANT[r.state]}>{RX_STATE_LABEL[r.state]}</Badge>,
    },
    {
      key: "prescriber",
      label: "Prescriber",
      sortValue: (r) => r.prescriberName ?? "",
      render: (r) => r.prescriberName ?? "–",
    },
    {
      key: "written",
      label: "Written",
      sortValue: (r) => r.writtenAt ?? "",
      render: (r) => <span className="text-text-muted">{r.writtenAt ? formatDate(r.writtenAt) : "–"}</span>,
    },
  ];

  if (lazy.error) return <Banner variant="danger">{lazy.error}</Banner>;
  if (rows === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Spinner size={24} />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface shadow-card">
        <EmptyState
          icon="pill-bottle"
          title="No prescriptions yet"
          subtext="Prescriptions written through Photon for your clients appear here."
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
        storageKey="photon.prescriptions.columns"
        onRowClick={open}
        selected={selected}
        onSelectedChange={setSelected}
        onExport={() => toast("Export isn’t wired up yet.", "info")}
        onRefresh={provided ? () => router.refresh() : lazy.reload}
        filter={
          <ChipMenu
            label="Filter"
            icon="list-filter"
            options={STATES.map((s) => ({ value: s, label: RX_STATE_LABEL[s] }))}
            values={[...states]}
            onToggle={(v) =>
              setStates((prev) => {
                const next = new Set(prev);
                if (!next.delete(v as PhotonRxState)) next.add(v as PhotonRxState);
                return next;
              })
            }
            onClear={() => setStates(new Set())}
          />
        }
        rowActions={(r) => (
          <KebabMenu label={`Actions for ${r.patientName}`}>
            <MenuItem icon="eye" label="View details" onClick={() => open(r)} />
            <MenuItem
              icon="person-circle"
              label="Open patient"
              onClick={() => router.push(`/clients/${r.clientId}?tab=rx`)}
            />
          </KebabMenu>
        )}
        toolbarLeft={
          <SearchInput
            className="max-w-md flex-1"
            placeholder="Search by patient"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        }
        footnote={
          truncated ? (
            <p className="text-[13px] text-text-muted">
              Showing the most recent prescriptions only — this organisation has more than the per-query limit.
            </p>
          ) : undefined
        }
      />
      {!onRowOpen && <RxDetailPanel prescriptionId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

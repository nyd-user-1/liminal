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
import { ORDER_STATE_LABEL, ORDER_STATE_VARIANT } from "@/components/photon/status";
import { RxDetailPanel } from "@/components/photon/rx-detail-panel";
import { inScope, type TableScope } from "@/components/tables/scope";
import { useLazyRows } from "@/components/tables/use-lazy-rows";
import { formatDate } from "@/lib/format";
import type { PhotonOrder, PhotonOrderState } from "@/lib/photon";

// The pharmacy-orders object table: everything from the search bar down, page
// chrome excluded. Mounted by /orders (server-fetched rows) and by the Clients
// rail (no rows → it loads its own through the API twin).

export type OrderRow = PhotonOrder & { clientId: string };

// Only the states this org actually produces get chips; the rest still render
// their badge if Photon returns them.
const STATES: PhotonOrderState[] = ["ROUTING", "PENDING", "PLACED", "COMPLETED", "CANCELED", "ERROR"];

export function OrdersTable({
  rows: provided,
  truncated: providedTruncated = false,
  scope = "all",
  onRowOpen,
}: {
  /** Server-fetched rows, already role-scoped. Omit to load through the twin. */
  rows?: OrderRow[];
  truncated?: boolean;
  scope?: TableScope;
  /** Overrides the built-in detail panel (the host drives the drill-down). */
  onRowOpen?: (row: OrderRow) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [states, setStates] = useState<Set<PhotonOrderState>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const lazy = useLazyRows<OrderRow>("/api/photon/orders/all", "orders", provided === undefined);
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

  // An order batches fills that can span prescriptions; the row drills into the
  // first one, and the panel names the others it covers.
  const open = (r: OrderRow) => (onRowOpen ? onRowOpen(r) : setDetailId(r.prescriptionIds[0] ?? null));

  const columns: DataTableColumn<OrderRow>[] = [
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
        onRowClick={open}
        selected={selected}
        onSelectedChange={setSelected}
        onExport={() => toast("Export isn’t wired up yet.", "info")}
        onRefresh={provided ? () => router.refresh() : lazy.reload}
        filter={
          <ChipMenu
            label="Filter"
            icon="list-filter"
            options={STATES.map((s) => ({ value: s, label: ORDER_STATE_LABEL[s] }))}
            values={[...states]}
            onToggle={(v) =>
              setStates((prev) => {
                const next = new Set(prev);
                if (!next.delete(v as PhotonOrderState)) next.add(v as PhotonOrderState);
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
              Showing the most recent orders only — this organisation has more than the per-query limit.
            </p>
          ) : undefined
        }
      />
      {!onRowOpen && <RxDetailPanel prescriptionId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { ChipMenu } from "@/components/rates/chip-menu";
import { ORDER_STATE_LABEL, ORDER_STATE_VARIANT } from "@/components/photon/status";
import { RxDetailPanel } from "@/components/photon/rx-detail-panel";
import { formatDate } from "@/lib/format";
import type { PhotonOrder, PhotonOrderState } from "@/lib/photon";

export type Row = PhotonOrder & { clientId: string };

// Only the states this org actually produces get chips; the rest still render
// their badge if Photon returns them.
const STATES: PhotonOrderState[] = ["ROUTING", "PENDING", "PLACED", "COMPLETED", "CANCELED", "ERROR"];

// Placeholder until this page earns real sections — the standard index layout
// carries a tab row (see /clients).
const TABS = [
  { key: "all", label: "All Orders" },
  { key: "tab2", label: "Tab 2" },
  { key: "tab3", label: "Tab 3" },
  { key: "tab4", label: "Tab 4" },
];

export function OrdersIndex({ rows, truncated }: { rows: Row[]; truncated: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [states, setStates] = useState<Set<PhotonOrderState>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
      <TopBarActions>
        <Button size="sm" leftIcon="plus" onClick={() => toast("New order isn\u2019t wired up yet.", "info")}>
          New order
        </Button>
        <IconButton icon="bell" label="Notifications" onClick={() => toast("No new notifications.", "info")} />
      </TopBarActions>

      <Tabs className="mt-4 mb-4 shrink-0" slideActive active={tab} onChange={setTab} items={TABS} />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        storageKey="photon.orders.columns"
        // An order batches fills that can span prescriptions; the row drills
        // into the first one, and the panel names the others it covers.
        onRowClick={(r) => setDetailId(r.prescriptionIds[0] ?? null)}
        selected={selected}
        onSelectedChange={setSelected}
        onExport={() => toast("Export isn\u2019t wired up yet.", "info")}
        onRefresh={() => router.refresh()}
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
            <MenuItem icon="eye" label="View details" onClick={() => setDetailId(r.prescriptionIds[0] ?? null)} />
            <MenuItem icon="person-circle" label="Open patient" onClick={() => router.push(`/clients/${r.clientId}?tab=rx`)} />
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
      <RxDetailPanel prescriptionId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}

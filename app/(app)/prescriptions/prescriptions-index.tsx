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
import { RX_STATE_LABEL, RX_STATE_VARIANT, quantityLabel } from "@/components/photon/status";
import { RxDetailPanel } from "@/components/photon/rx-detail-panel";
import { formatDate } from "@/lib/format";
import type { PhotonRxListRow, PhotonRxState } from "@/lib/photon";

// Org-wide Rx list. Rows arrive pre-scoped by role from the server page; this
// component only searches, filters and drills in.

export type Row = PhotonRxListRow & { clientId: string };

// Photon's DRAFT state exists in the schema but never reaches a list like this
// (a draft isn't a written prescription), so it gets no chip — if one ever
// shows up it still renders its badge, it just isn't filterable.
const STATES: PhotonRxState[] = ["ACTIVE", "DEPLETED", "EXPIRED", "CANCELED"];

// Placeholder until this page earns real sections — the standard index layout
// carries a tab row (see /clients).
const TABS = [
  { key: "all", label: "All Prescriptions" },
  { key: "tab2", label: "Tab 2" },
  { key: "tab3", label: "Tab 3" },
  { key: "tab4", label: "Tab 4" },
];

export function PrescriptionsIndex({ rows, truncated }: { rows: Row[]; truncated: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [states, setStates] = useState<Set<PhotonRxState>>(new Set());
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
      <TopBarActions>
        <Button size="sm" leftIcon="plus" onClick={() => toast("New prescription isn\u2019t wired up yet.", "info")}>
          New prescription
        </Button>
        <IconButton icon="bell" label="Notifications" onClick={() => toast("No new notifications.", "info")} />
      </TopBarActions>

      <Tabs className="mt-4 mb-4 shrink-0" slideActive active={tab} onChange={setTab} items={TABS} />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        storageKey="photon.prescriptions.columns"
        onRowClick={(r) => setDetailId(r.id)}
        selected={selected}
        onSelectedChange={setSelected}
        onExport={() => toast("Export isn\u2019t wired up yet.", "info")}
        onRefresh={() => router.refresh()}
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
            <MenuItem icon="eye" label="View details" onClick={() => setDetailId(r.id)} />
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
              Showing the most recent prescriptions only — this organisation has more than the per-query limit.
            </p>
          ) : undefined
        }
      />
      <RxDetailPanel prescriptionId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}

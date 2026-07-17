"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { AddTreatmentPanel } from "@/components/photon/add-treatment-panel";
import { useLazyRows } from "@/components/tables/use-lazy-rows";
import type { PhotonTreatment } from "@/lib/photon";

// The treatment-catalog object table: the org's formulary, i.e. what the
// prescribe flow offers. Mounted by /catalog (server-fetched rows) and by the
// Clients rail (no rows → it loads its own through the API twin).
//
// No `scope` prop, unlike the other object tables: a catalog is org-level
// config, not something a client has one of.

export function CatalogTable({
  treatments: provided,
  catalogName: providedName,
  addOpen: controlledAddOpen,
  onAddOpenChange,
  onRowOpen,
}: {
  /** Server-fetched treatments. Omit to load through the twin. */
  treatments?: PhotonTreatment[];
  catalogName?: string;
  /** Controlled when the host owns the create trigger (the TopBar's New button). */
  addOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
  onRowOpen?: (row: PhotonTreatment) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpenSelf, setAddOpenSelf] = useState(false);

  const addOpen = controlledAddOpen ?? addOpenSelf;
  const setAddOpen = onAddOpenChange ?? setAddOpenSelf;

  const lazy = useLazyRows<PhotonTreatment>("/api/photon/catalog", "treatments", provided === undefined);
  const treatments = provided ?? lazy.rows;
  const catalogName = providedName ?? (lazy.data?.catalogName as string | undefined) ?? "the catalog";

  const refresh = provided ? () => router.refresh() : lazy.reload;

  async function remove(t: PhotonTreatment) {
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/photon/catalog?treatmentId=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast(json?.error ?? "Could not remove this treatment.", "danger");
        return;
      }
      toast(`Removed ${t.name}.`, "success");
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  const shown = filter.trim()
    ? (treatments ?? []).filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : (treatments ?? []);

  const columns: DataTableColumn<PhotonTreatment>[] = [
    {
      key: "name",
      label: "Treatment",
      fixed: true,
      sortValue: (t) => t.name,
      cellClassName: "max-w-[36rem]",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium" title={t.name}>
            {t.name}
          </p>
          {t.description && (
            <p className="truncate text-[13px] text-text-muted" title={t.description}>
              {t.description}
            </p>
          )}
        </div>
      ),
    },
  ];

  if (lazy.error) return <Banner variant="danger">{lazy.error}</Banner>;
  if (treatments === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <>
      {treatments.length === 0 ? (
        <div className="rounded-card border border-border bg-surface shadow-card">
          <EmptyState
            icon="grid"
            title="No treatments in the catalog"
            subtext="Add treatments to control what the prescribe flow offers."
            actions={
              <Button leftIcon="plus" onClick={() => setAddOpen(true)}>
                Add treatment
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={(t) => t.id}
          storageKey="photon.catalog.columns"
          selected={selected}
          onSelectedChange={setSelected}
          onRowClick={onRowOpen}
          onExport={() => toast("Export isn’t wired up yet.", "info")}
          onRefresh={refresh}
          rowActions={(t) => (
            <KebabMenu label={`Actions for ${t.name}`}>
              <MenuItem icon="trash" label={busyId === t.id ? "Removing…" : "Remove"} danger onClick={() => remove(t)} />
            </KebabMenu>
          )}
          toolbarLeft={
            <SearchInput
              className="max-w-md flex-1"
              placeholder="Search the catalog"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          }
          footnote={
            <p className="text-[13px] text-text-muted">
              {treatments.length} treatment{treatments.length === 1 ? "" : "s"} in {catalogName}.
            </p>
          }
        />
      )}

      <AddTreatmentPanel
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existing={new Set(treatments.map((t) => t.id))}
        onAdded={refresh}
      />
    </>
  );
}

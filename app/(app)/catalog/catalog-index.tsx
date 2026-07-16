"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { SidePanel } from "@/components/ui/side-panel";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { IconButton } from "@/components/ui/icon-button";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Tabs } from "@/components/ui/tabs";
import { TopBarActions } from "@/components/shell/topbar-slot";
import type { PhotonTreatment, TreatmentSearchHit } from "@/lib/photon";

// Catalog management, mirroring Photon's own page: the current treatments, a
// search-to-add panel, and remove. Both mutations are real (addToCatalog /
// removeFromCatalog) — verified against the sandbox with the M2M token.

// Placeholder until this page earns real sections — the standard index layout
// carries a tab row (see /clients).
const TABS = [
  { key: "all", label: "All Treatments" },
  { key: "tab2", label: "Tab 2" },
  { key: "tab3", label: "Tab 3" },
  { key: "tab4", label: "Tab 4" },
];

export function CatalogIndex({ catalogName, treatments }: { catalogName: string; treatments: PhotonTreatment[] }) {
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const shown = filter.trim()
    ? treatments.filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : treatments;

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
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

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

  return (
    <>
      <TopBarActions>
        <Button size="sm" leftIcon="plus" onClick={() => setAddOpen(true)}>
          New treatment
        </Button>
        <IconButton icon="bell" label="Notifications" onClick={() => toast("No new notifications.", "info")} />
      </TopBarActions>

      <Tabs className="mt-4 mb-4 shrink-0" slideActive active={tab} onChange={setTab} items={TABS} />

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
          selected={selected}
          onSelectedChange={setSelected}
          onExport={() => toast("Export isn\u2019t wired up yet.", "info")}
          onRefresh={() => router.refresh()}
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
        onAdded={() => router.refresh()}
      />
    </>
  );
}

function AddTreatmentPanel({
  open,
  onClose,
  existing,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  existing: Set<string>;
  onAdded: () => void;
}) {
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<TreatmentSearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  // Guards against a slow response for an earlier term overwriting a newer one.
  const seq = useRef(0);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setHits(null);
    }
  }, [open]);

  // Debounced search — Photon's medication index is large and the panel types
  // into it directly.
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    const mine = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/photon/treatments?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (mine !== seq.current) return;
        if (!res.ok) {
          toast(json?.error ?? "Could not search treatments.", "danger");
          setHits([]);
          return;
        }
        setHits(json.treatments ?? []);
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [term, toast]);

  async function add(hit: TreatmentSearchHit) {
    setAddingId(hit.id);
    try {
      const res = await fetch("/api/photon/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treatmentId: hit.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json?.error ?? "Could not add this treatment.", "danger");
        return;
      }
      toast(`Added ${hit.name}.`, "success");
      onAdded();
      onClose();
    } finally {
      setAddingId(null);
    }
  }

  return (
    <SidePanel open={open} onClose={onClose} title="Add treatment" icon="plus" width="max-w-2xl" mobileSheet>
      <SearchInput
        autoFocus
        placeholder="Search Photon's medications (e.g. lisinopril)"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      <div className="mt-4">
        {busy ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : hits === null ? (
          <EmptyState icon="search" title="Search to add" subtext="Type at least two characters." />
        ) : hits.length === 0 ? (
          <EmptyState icon="search" title="No matches" subtext="Try a different medication name." />
        ) : (
          <ul className="flex flex-col gap-2">
            {hits.map((h) => {
              const already = existing.has(h.id);
              return (
                <li key={h.id} className="flex items-center justify-between gap-3 rounded-card border border-border bg-canvas p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text" title={h.name}>
                      {h.name}
                    </p>
                    <p className="text-[13px] text-text-muted">{[h.strength, h.form].filter(Boolean).join(" · ") || "–"}</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => add(h)}
                    disabled={already || addingId === h.id}
                    title={already ? "Already in the catalog" : undefined}
                  >
                    {already ? "Added" : addingId === h.id ? "Adding…" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SidePanel>
  );
}

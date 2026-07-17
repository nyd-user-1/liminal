"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { SidePanel } from "@/components/ui/side-panel";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import type { TreatmentSearchHit } from "@/lib/photon";

// Search-to-add against Photon's medication index. Lifted out of the catalog
// page when the catalog became a portable table — the panel is the catalog's
// create flow wherever that table is mounted.

export function AddTreatmentPanel({
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
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 rounded-card border border-border bg-canvas p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text" title={h.name}>
                      {h.name}
                    </p>
                    <p className="text-[13px] text-text-muted">
                      {[h.strength, h.form].filter(Boolean).join(" · ") || "–"}
                    </p>
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import type { CanvasDoc, CanvasMapMeta } from "@/lib/canvas";

// /maps — the relationship-map builder. The canvas (BuilderCanvas) owns
// nodes/edges; this client owns the DOCUMENT: which saved map is open, its
// name, and the save/load/delete loop against /api/maps. The canvas remounts
// (key) whenever a different doc loads, so React Flow state never leaks
// between maps.

const BuilderCanvas = dynamic(() => import("@/components/maps/builder-canvas").then((m) => m.BuilderCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <Spinner size={22} className="text-text-muted" />
    </div>
  ),
});

export function MapsClient({ payers, initialMaps }: { payers: string[]; initialMaps: CanvasMapMeta[] }) {
  const [maps, setMaps] = useState<CanvasMapMeta[]>(initialMaps);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [loadedDoc, setLoadedDoc] = useState<CanvasDoc | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // The canvas reports its serializable doc here on every change — a ref, not
  // state, so drags don't re-render this shell.
  const docRef = useRef<CanvasDoc | null>(null);
  const onDocChange = useCallback((doc: CanvasDoc) => {
    docRef.current = doc;
  }, []);

  const save = async () => {
    const doc = docRef.current ?? { nodes: [], code: "90837" };
    const finalName = name.trim() || "Untitled map";
    setSaving(true);
    try {
      if (currentId) {
        const res = await fetch(`/api/maps/${currentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: finalName, doc }),
        });
        if (res.ok) {
          setName(finalName);
          setMaps((ms) =>
            ms
              .map((m) => (m.id === currentId ? { ...m, name: finalName, updatedAt: new Date().toISOString() } : m))
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          );
        }
      } else {
        const res = await fetch("/api/maps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: finalName, doc }),
        });
        const data = (await res.json()) as { map?: CanvasMapMeta };
        if (data.map) {
          setCurrentId(data.map.id);
          setName(data.map.name);
          setMaps((ms) => [data.map!, ...ms]);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const load = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/maps/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { meta: CanvasMapMeta; doc: CanvasDoc };
      setCurrentId(data.meta.id);
      setName(data.meta.name);
      setLoadedDoc(data.doc);
      docRef.current = data.doc;
      setCanvasKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const newMap = () => {
    setCurrentId(null);
    setName("");
    setLoadedDoc(null);
    docRef.current = null;
    setCanvasKey((k) => k + 1);
  };

  const del = async () => {
    if (!currentId) return;
    if (!window.confirm(`Delete "${name.trim() || "Untitled map"}"? This can't be undone.`)) return;
    const res = await fetch(`/api/maps/${currentId}`, { method: "DELETE" });
    if (res.ok) {
      setMaps((ms) => ms.filter((m) => m.id !== currentId));
      newMap();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBarActions>
        <MapsMenu maps={maps} currentId={currentId} onLoad={load} onNew={newMap} onDelete={currentId ? del : undefined} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled map"
          aria-label="Map name"
          className="h-9 w-44 rounded-field bg-black/[0.04] px-3 text-[14px] text-text outline-none placeholder:text-text-muted focus:ring-2 focus:ring-primary/30"
        />
        <Button size="sm" onClick={() => void save()} disabled={saving || loading}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </TopBarActions>
      <BuilderCanvas key={canvasKey} payers={payers} initialDoc={loadedDoc} onDocChange={onDocChange} />
    </div>
  );
}

// The saved-maps switcher — the ContextSwitcher pill pattern over this user's
// documents: New map · the list (newest first) · Delete current.
function MapsMenu({
  maps,
  currentId,
  onLoad,
  onNew,
  onDelete,
}: {
  maps: CanvasMapMeta[];
  currentId: string | null;
  onLoad: (id: string) => void;
  onNew: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = maps.find((m) => m.id === currentId);
  const pick = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-9 items-center gap-1.5 rounded-field bg-black/[0.04] pl-3 pr-2 text-[14px] transition-colors ${
          open ? "text-primary" : "text-text-body hover:text-primary"
        }`}
      >
        <span className="max-w-[160px] truncate font-medium">{current ? current.name : "My maps"}</span>
        <span className="ml-0.5 flex shrink-0 flex-col text-text-muted" aria-hidden>
          <Icon name="chevron-up" size={12} className="-mb-[3px]" />
          <Icon name="chevron-down" size={12} className="-mt-[3px]" />
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-card border border-border bg-surface shadow-menu"
        >
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => pick(onNew)}
              className="flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left text-[14px] font-medium text-text-body transition-colors hover:bg-[rgba(0,0,0,0.05)] hover:text-text"
            >
              <Icon name="plus" size={16} className="text-text-muted" />
              New map
            </button>
          </div>
          {maps.length > 0 && (
            <div className="max-h-72 overflow-y-auto border-t border-border p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {maps.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(() => onLoad(m.id))}
                  className={`flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left text-[14px] transition-colors ${
                    m.id === currentId
                      ? "bg-[rgba(0,0,0,0.05)] text-text"
                      : "text-text-body hover:bg-[rgba(0,0,0,0.05)] hover:text-text"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                  <span className="text-[12px] text-text-muted">{m.updatedAt.slice(0, 10)}</span>
                </button>
              ))}
            </div>
          )}
          {onDelete && (
            <div className="border-t border-border p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => pick(onDelete)}
                className="flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left text-[14px] text-danger transition-colors hover:bg-danger-tint"
              >
                <Icon name="x" size={15} />
                Delete this map
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

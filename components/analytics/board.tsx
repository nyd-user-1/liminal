"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { TopBarActions } from "@/components/shell/topbar-slot";
import {
  BUILT_IN_VIEWS,
  METRIC_BY_KEY,
  metricsForRole,
  viewsForRole,
  type BoardView,
  type MetricValues,
} from "@/lib/analytics/metrics";
import { DictionaryPanel } from "./dictionary-panel";
import { KpiLibraryPanel, DRAG_TYPE } from "./kpi-library-panel";
import { MetricCard } from "./metric-card";
import type { DictionaryEntry } from "@/lib/repos/analytics";

// The board — hq's fleet-view/fleet-grid, rebuilt to this brief's simpler
// contract: cards flow in a responsive CSS grid and carry a SIZE STEP
// (1-col / 2-col / full-width) rather than hq's free-form 12-col pixel grid.
// Reordering is drag-and-drop; adding is drag-in from the library (the same
// dataTransfer handshake hq uses) or click-to-add.
//
// Why a flow grid and not hq's absolute-positioned one: hq's grid exists to let
// a card sit anywhere on a 12-col canvas, and pays for it with collision
// resolution + a px-height model. This board only needs order + width, and a
// flow grid gets responsive stacking for free — the same reason the rest of
// Liminal's pages use grids, not canvases.

export type CardSize = "sm" | "md" | "lg";

const SPAN: Record<CardSize, string> = {
  sm: "col-span-1",
  md: "col-span-1 sm:col-span-2",
  lg: "col-span-1 sm:col-span-2 xl:col-span-4",
};
const HEIGHT: Record<CardSize, string> = {
  sm: "h-[180px]",
  md: "h-[264px]",
  lg: "h-[340px]",
};
const NEXT_SIZE: Record<CardSize, CardSize> = { sm: "md", md: "lg", lg: "sm" };
const SIZE_LABEL: Record<CardSize, string> = { sm: "small", md: "wide", lg: "full width" };

/** A metric's natural size — stats are tiles, everything else wants room. */
function defaultSize(key: string): CardSize {
  const kind = METRIC_BY_KEY[key]?.kind;
  if (kind === "stat") return "sm";
  if (kind === "table" || kind === "agenda") return "md";
  return "md";
}

interface BoardState {
  ids: string[];
  sizes: Record<string, CardSize>;
}

const KEY_PREFIX = "liminal-analytics:";
const VIEW_KEY = `${KEY_PREFIX}view`;
const USER_VIEWS_KEY = `${KEY_PREFIX}views`;
const boardKey = (view: string) => `${KEY_PREFIX}board:${view}`;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage disabled — the board still works, it just won't persist */
  }
}

export function AnalyticsBoard({
  values,
  dictionary,
  isAdmin,
  generatedAt,
}: {
  values: MetricValues;
  dictionary: Record<string, DictionaryEntry>;
  isAdmin: boolean;
  generatedAt: string;
}) {
  const catalog = useMemo(() => metricsForRole(isAdmin), [isAdmin]);
  const allowed = useMemo(() => new Set(catalog.map((m) => m.key)), [catalog]);

  const [userViews, setUserViews] = useState<BoardView[]>([]);
  // Seeded synchronously with the default view so the SERVER renders a real
  // Overview — not an empty board that only fills in after hydration. The
  // effect below then adopts whatever this browser had saved.
  const [viewName, setViewName] = useState<string>(() => viewsForRole(BUILT_IN_VIEWS, isAdmin)[0]?.name ?? "Overview");
  const [board, setBoard] = useState<BoardState>(() => ({
    ids: viewsForRole(BUILT_IN_VIEWS, isAdmin)[0]?.ids ?? [],
    sizes: {},
  }));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [aboutKey, setAboutKey] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState(false);
  const [ready, setReady] = useState(false);

  const views = useMemo(() => viewsForRole([...BUILT_IN_VIEWS, ...userViews], isAdmin), [userViews, isAdmin]);

  // Bootstrap from storage once mounted (server render has no localStorage, so
  // the first paint is the default view — then we adopt whatever was saved).
  useEffect(() => {
    const savedViews = readJson<BoardView[]>(USER_VIEWS_KEY) ?? [];
    setUserViews(savedViews.filter((v) => Array.isArray(v.ids)));
    const all = viewsForRole([...BUILT_IN_VIEWS, ...savedViews], isAdmin);
    const savedName = localStorage.getItem(VIEW_KEY);
    const active = all.find((v) => v.name === savedName) ?? all[0];
    const savedBoard = active ? readJson<BoardState>(boardKey(active.name)) : null;
    const ids = (savedBoard?.ids ?? active?.ids ?? []).filter((id) => allowed.has(id));
    setViewName(active?.name ?? BUILT_IN_VIEWS[0].name);
    setBoard({ ids, sizes: savedBoard?.sizes ?? {} });
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const persist = useCallback(
    (name: string, next: BoardState) => {
      writeJson(boardKey(name), next);
      localStorage.setItem(VIEW_KEY, name);
    },
    [],
  );

  const commit = useCallback(
    (next: BoardState) => {
      setBoard(next);
      if (ready) persist(viewName, next);
    },
    [ready, persist, viewName],
  );

  const addMetric = useCallback(
    (key: string, at?: number) => {
      if (!allowed.has(key)) return;
      setBoard((b) => {
        if (b.ids.includes(key)) return b;
        const ids = [...b.ids];
        ids.splice(at ?? ids.length, 0, key);
        const next = { ...b, ids };
        persist(viewName, next);
        return next;
      });
    },
    [allowed, persist, viewName],
  );

  const removeMetric = useCallback(
    (key: string) => {
      setBoard((b) => {
        const next = { ...b, ids: b.ids.filter((k) => k !== key) };
        persist(viewName, next);
        return next;
      });
    },
    [persist, viewName],
  );

  const resizeMetric = useCallback(
    (key: string) => {
      setBoard((b) => {
        const cur = b.sizes[key] ?? defaultSize(key);
        const next = { ...b, sizes: { ...b.sizes, [key]: NEXT_SIZE[cur] } };
        persist(viewName, next);
        return next;
      });
    },
    [persist, viewName],
  );

  const applyView = useCallback(
    (v: BoardView) => {
      const saved = readJson<BoardState>(boardKey(v.name));
      const next: BoardState = {
        ids: (saved?.ids ?? v.ids).filter((id) => allowed.has(id)),
        sizes: saved?.sizes ?? {},
      };
      setViewName(v.name);
      setBoard(next);
      persist(v.name, next);
    },
    [allowed, persist],
  );

  const saveView = useCallback(
    (name: string) => {
      const n = name.trim();
      if (!n) return;
      const next = [...userViews.filter((v) => v.name !== n), { name: n, ids: board.ids }];
      setUserViews(next);
      writeJson(USER_VIEWS_KEY, next);
      writeJson(boardKey(n), board);
      setViewName(n);
      localStorage.setItem(VIEW_KEY, n);
    },
    [board, userViews],
  );

  const resetView = useCallback(() => {
    const v = views.find((x) => x.name === viewName);
    if (!v) return;
    const next: BoardState = { ids: v.ids.filter((id) => allowed.has(id)), sizes: {} };
    setBoard(next);
    persist(viewName, next);
  }, [views, viewName, allowed, persist]);

  // Reorder: the dragged card is spliced in ahead of whatever card it's over.
  const reorder = useCallback(
    (from: string, to: string) => {
      if (from === to) return;
      setBoard((b) => {
        const ids = b.ids.filter((k) => k !== from);
        const at = ids.indexOf(to);
        ids.splice(at < 0 ? ids.length : at, 0, from);
        const next = { ...b, ids };
        persist(viewName, next);
        return next;
      });
    },
    [persist, viewName],
  );

  const placed = board.ids.filter((id) => METRIC_BY_KEY[id] && allowed.has(id));

  return (
    <>
      <TopBarActions>
        <Button size="sm" variant="secondary" leftIcon="grid" onClick={() => setLibraryOpen(true)}>
          Add metrics
        </Button>
      </TopBarActions>

      {/* Board toolbar: the active view, its card count, and the view actions. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className="truncate text-lg font-semibold text-text">{viewName}</h2>
          <span className="shrink-0 text-[13px] text-text-muted">
            {placed.length} {placed.length === 1 ? "card" : "cards"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="ghost" leftIcon="refresh-cw" onClick={resetView}>
            Reset
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leftIcon="plus"
            onClick={() => {
              const name = window.prompt("Save this board as a view named:", viewName === "Custom" ? "" : viewName);
              if (name) saveView(name);
            }}
          >
            Save view
          </Button>
          <Button size="sm" variant="secondary" leftIcon="list-filter" onClick={() => setLibraryOpen(true)}>
            KPI library
          </Button>
        </div>
      </div>

      {/* The drop surface: dragging a metric in from the library adds it. */}
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_TYPE)) {
            e.preventDefault();
            setDropHint(true);
          }
        }}
        onDragLeave={() => setDropHint(false)}
        onDrop={(e) => {
          setDropHint(false);
          const id = e.dataTransfer.getData(DRAG_TYPE) || e.dataTransfer.getData("text/plain");
          if (id) {
            e.preventDefault();
            addMetric(id);
          }
        }}
        className={`min-h-[60vh] rounded-card transition-colors ${dropHint ? "bg-primary-wash outline-dashed outline-2 outline-offset-4 outline-primary" : ""}`}
      >
        {placed.length === 0 ? (
          <EmptyState
            icon="grid"
            title="An empty board"
            subtext="Open the KPI library and drag a metric here — or click one to add it."
            actions={
              <Button variant="primary" leftIcon="plus" onClick={() => setLibraryOpen(true)}>
                Open KPI library
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {placed.map((key) => {
              const def = METRIC_BY_KEY[key];
              const size = board.sizes[key] ?? defaultSize(key);
              return (
                <div
                  key={key}
                  // data-card is a test hook: the board's interactions are only
                  // real if a browser can drive them (see an-verify).
                  data-card={key}
                  onDragOver={(e) => {
                    if (dragId && dragId !== key) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (dragId) {
                      e.preventDefault();
                      e.stopPropagation();
                      reorder(dragId, key);
                      setDragId(null);
                    }
                  }}
                  className={`${SPAN[size]} ${HEIGHT[size]} ${dragId === key ? "opacity-40" : ""}`}
                >
                  <MetricCard
                    def={def}
                    value={values[key]}
                    size={SIZE_LABEL[size]}
                    onRemove={() => removeMetric(key)}
                    onAbout={() => setAboutKey(key)}
                    onResize={() => resizeMetric(key)}
                    dragHandle={
                      <span
                        draggable
                        onDragStart={(e) => {
                          setDragId(key);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", key);
                        }}
                        onDragEnd={() => setDragId(null)}
                        title="Drag to reorder"
                        aria-label={`Reorder ${def.label}`}
                        className="cursor-grab rounded p-1 text-text-muted opacity-0 transition hover:bg-canvas hover:text-text group-hover/card:opacity-100 active:cursor-grabbing"
                      >
                        <Icon name="dots-horizontal" size={14} />
                      </span>
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-4 text-[13px] text-text-muted">
        Numbers read at {new Date(generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · the board
        (which cards, what order, what size) is remembered in this browser.
      </p>

      <KpiLibraryPanel
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        catalog={catalog}
        placed={placed}
        views={views}
        activeView={viewName}
        onAdd={addMetric}
        onRemove={removeMetric}
        onApplyView={applyView}
      />

      <DictionaryPanel
        entryKey={aboutKey}
        entry={aboutKey ? dictionary[METRIC_BY_KEY[aboutKey]?.sourceTable] : undefined}
        def={aboutKey ? METRIC_BY_KEY[aboutKey] : undefined}
        value={aboutKey ? values[aboutKey] : undefined}
        onClose={() => setAboutKey(null)}
      />
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BoardGrid, reorderIds, type BoardCardSize } from "@/components/board/board-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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

// The analytics board — this is now composition, not machinery: BoardGrid owns
// the layout, the reorder drag, and the card affordances; this file owns which
// metrics are placed, the size ladder, views, and persistence. The board is
// also the drop surface for a drag-in from the KPI library (the same
// dataTransfer handshake hq uses); click-to-add is the other route in.

type CardSize = BoardCardSize;

const NEXT_SIZE: Record<CardSize, CardSize> = { sm: "md", md: "lg", lg: "sm" };
const SIZE_ORDER: CardSize[] = ["sm", "md", "lg"];
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

  /** Corner-handle resize: step up or down the size ladder, clamped at the
   *  ends — dragging outward past lg (or inward past sm) is a no-op, unlike
   *  the kebab's cycle. */
  const stepMetricSize = useCallback(
    (key: string, dir: 1 | -1) => {
      setBoard((b) => {
        const cur = b.sizes[key] ?? defaultSize(key);
        const idx = Math.min(Math.max(SIZE_ORDER.indexOf(cur) + dir, 0), SIZE_ORDER.length - 1);
        if (SIZE_ORDER[idx] === cur) return b;
        const next = { ...b, sizes: { ...b.sizes, [key]: SIZE_ORDER[idx] } };
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

  // Reorder: the dragged card lands on the far side of the card it was dropped
  // on (reorderIds owns the rule — see the primitive).
  const reorder = useCallback(
    (from: string, to: string) => {
      setBoard((b) => {
        const next = { ...b, ids: reorderIds(b.ids, from, to) };
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
          <BoardGrid
            items={placed}
            size={(key) => board.sizes[key] ?? defaultSize(key)}
            onReorder={reorder}
            renderCard={(key) => (
              <MetricCard
                def={METRIC_BY_KEY[key]}
                value={values[key]}
                size={SIZE_LABEL[board.sizes[key] ?? defaultSize(key)]}
                onRemove={() => removeMetric(key)}
                onAbout={() => setAboutKey(key)}
                onResize={() => resizeMetric(key)}
                onResizeStep={(dir) => stepMetricSize(key, dir)}
              />
            )}
          />
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

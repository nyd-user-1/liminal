"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

// A board: cards live on a 12-column canvas in grid units, exactly hq's
// fleet-grid (~/Code/hq/app/ui/fleet-grid.tsx) — absolute positions, a 24px row
// unit, drag that tracks the pointer 1:1 with the neighbours reflowing LIVE,
// and a corner resize that is continuous, not a ladder. That model is the whole
// feel: the first cut here was a CSS flow grid ("responsive stacking for
// free"), and it cost the fluidity — cards teleported on drop and resize moved
// one step per gesture. This is the faithful port, in this theme's chrome.
//
// Generic by construction: this file knows ids and boxes. What a card CONTAINS
// is entirely the caller's (renderCard). Nothing here may import a feature.

export type BoardBox = { x: number; y: number; w: number; h: number };
/** Presence + the card's default/minimum footprint, in grid units. */
export type BoardItem = { id: string; w: number; h: number; minW?: number; minH?: number };

export const BOARD_COLS = 12;
/** px per grid row — hq's unit. Card heights are h × this. */
export const BOARD_ROW = 24;
const MINW = 2;
const MINH = 4;
/** Gutter = padding inside each cell wrapper, so 2× this separates cards. */
const CELL_PAD = 6;

const HOLD_MS = 150; // hq's whole-card engage delay…
const SLOP_PX = 4; // …or this much travel, whichever lands first

/** Per-card drag state, published by BoardGrid and read by BoardCard. Null
 *  outside a grid — a BoardCard on its own is simply a static card. */
export interface BoardCardDrag {
  isDragging: boolean;
  /** Pointer-down on the ⠿ grip: engages the move immediately (no hold). */
  grab: (e: ReactPointerEvent) => void;
  /** Pointer-down on the corner handle: engages a live resize. */
  resizeStart: (e: ReactPointerEvent) => void;
}
const BoardCardContext = createContext<BoardCardDrag | null>(null);
export const useBoardCardDrag = () => useContext(BoardCardContext);

// Shelf-pack in reading order → the default layout mirrors a sensible static
// one (small tiles banding across, big cards below).
function defaults(items: BoardItem[]): Record<string, BoardBox> {
  const out: Record<string, BoardBox> = {};
  let cx = 0,
    cy = 0,
    rowH = 0;
  for (const it of items) {
    const w = Math.min(BOARD_COLS, it.w);
    if (cx + w > BOARD_COLS) {
      cx = 0;
      cy += rowH;
      rowH = 0;
    }
    out[it.id] = { x: cx, y: cy, w, h: it.h };
    cx += w;
    rowH = Math.max(rowH, it.h);
  }
  return out;
}

function overlaps(a: BoardBox, b: BoardBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** hq's collision rule, verbatim: the anchor stays put; anything it overlaps is
 *  pushed straight DOWN until clear, cascading. O(n²·passes) — trivial at
 *  board scale. This is what makes a drag feel alive: it runs on every render
 *  of an in-flight drag, so the neighbours slide out of the way in real time. */
function resolve(input: Record<string, BoardBox>, anchorId: string): Record<string, BoardBox> {
  const boxes: Record<string, BoardBox> = {};
  for (const k of Object.keys(input)) boxes[k] = { ...input[k] };
  const ids = Object.keys(boxes);
  let guard = 0;
  let moved = true;
  while (moved && guard++ < 200) {
    moved = false;
    const order = ids.slice().sort((a, b) => {
      if (a === anchorId) return -1;
      if (b === anchorId) return 1;
      return boxes[a].y - boxes[b].y || boxes[a].x - boxes[b].x;
    });
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const A = boxes[order[i]];
        const B = boxes[order[j]];
        if (overlaps(A, B)) {
          boxes[order[j]] = { ...B, y: A.y + A.h };
          moved = true;
        }
      }
    }
  }
  return boxes;
}

/** Float every box up until it rests on another card or the top — so removing
 *  or shrinking something doesn't leave a permanent hole. hq lives without
 *  this; a record board adds/removes cards constantly and wants the tidy-up. */
function compact(input: Record<string, BoardBox>): Record<string, BoardBox> {
  const boxes: Record<string, BoardBox> = {};
  for (const k of Object.keys(input)) boxes[k] = { ...input[k] };
  const order = Object.keys(boxes).sort((a, b) => boxes[a].y - boxes[b].y || boxes[a].x - boxes[b].x);
  for (const id of order) {
    const b = boxes[id];
    let y = b.y;
    while (y > 0) {
      const probe = { ...b, y: y - 1 };
      if (order.some((o) => o !== id && overlaps(probe, boxes[o]))) break;
      y -= 1;
    }
    boxes[id] = { ...b, y };
  }
  return boxes;
}

export function BoardGrid({
  items,
  storageKey,
  epoch = 0,
  renderCard,
  className = "",
}: {
  /** Cards on the board, in reading order (drives defaults for new ids). */
  items: BoardItem[];
  /** Persist the arrangement (boxes) under this key. Omit = session-only. */
  storageKey?: string;
  /** Bump to rebuild from defaults — the caller's "reset layout". */
  epoch?: number;
  renderCard: (id: string) => ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cellW, setCellW] = useState(0);
  const [layout, setLayout] = useState<Record<string, BoardBox>>(() => defaults(items));
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize"; box: BoardBox } | null>(null);
  const startRef = useRef<{ px: number; py: number; box: BoardBox; minW: number; minH: number } | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const persist = useCallback(
    (l: Record<string, BoardBox>) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(l));
      } catch {
        /* storage disabled — the board still works, it just won't persist */
      }
    },
    [storageKey],
  );

  // Rebuild whenever the item set, the storage key, or the epoch changes:
  // defaults for everything, saved boxes overlaid for ids still present, ids
  // the save has never seen placed on a fresh shelf BELOW the saved layout
  // (a new card must never land on top of an arrangement someone made).
  const idKey = items.map((i) => i.id).join(",");
  useEffect(() => {
    let saved: Record<string, BoardBox> | null = null;
    if (storageKey) {
      try {
        const raw = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (raw && typeof raw === "object" && !Array.isArray(raw)) saved = raw as Record<string, BoardBox>;
      } catch {
        /* ignore */
      }
    }
    const next = defaults(itemsRef.current);
    if (saved) {
      const known = itemsRef.current.filter((it) => saved[it.id]);
      const fresh = itemsRef.current.filter((it) => !saved[it.id]);
      for (const it of known) next[it.id] = saved[it.id];
      let shelf = known.length ? Math.max(...known.map((it) => saved[it.id].y + saved[it.id].h)) : 0;
      let cx = 0;
      let rowH = 0;
      for (const it of fresh) {
        const w = Math.min(BOARD_COLS, it.w);
        if (cx + w > BOARD_COLS) {
          cx = 0;
          shelf += rowH;
          rowH = 0;
        }
        next[it.id] = { x: cx, y: shelf, w, h: it.h };
        cx += w;
        rowH = Math.max(rowH, it.h);
      }
      // Ids removed since the save fall out here; float the rest up.
      const merged = compact(next);
      for (const k of Object.keys(merged)) next[k] = merged[k];
    }
    setLayout(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, idKey, epoch]);

  // Measure the canvas → cell width (the only measurement; positions are math).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = () => setCellW(el.clientWidth / BOARD_COLS);
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const begin = useCallback(
    (id: string, mode: "move" | "resize", e: { clientX: number; clientY: number }) => {
      const it = itemsRef.current.find((i) => i.id === id);
      setLayout((cur) => {
        const box = cur[id];
        if (box) {
          startRef.current = {
            px: e.clientX,
            py: e.clientY,
            box,
            minW: Math.max(MINW, it?.minW ?? MINW),
            minH: Math.max(MINH, it?.minH ?? MINH),
          };
          setDrag({ id, mode, box });
        }
        return cur;
      });
    },
    [],
  );

  // hq's startHold: a press on the card engages the move after a short hold OR
  // a few px of travel — whichever lands first — so a plain click never nudges
  // the board, and so text/controls inside the card stay usable.
  const INTERACTIVE =
    'a, button, input, select, textarea, label, [role="button"], [role="menuitem"], [contenteditable="true"], [data-board-no-drag]';
  const hold = useCallback(
    (id: string, e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
      const px = e.clientX;
      const py = e.clientY;
      let timer = 0;
      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
      }
      function engage(ev: { clientX: number; clientY: number }) {
        cleanup();
        begin(id, "move", ev);
      }
      function move(ev: PointerEvent) {
        if (Math.hypot(ev.clientX - px, ev.clientY - py) > SLOP_PX) engage(ev);
      }
      timer = window.setTimeout(() => engage({ clientX: px, clientY: py }), HOLD_MS);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    },
    [begin],
  );

  // The live drag: grid-unit deltas from the press point, clamped to the
  // canvas; every render resolves collisions so the neighbours reflow under
  // the pointer. Window-level so the drag survives leaving the board.
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const st = startRef.current;
      if (!st || !cellW) return;
      const dx = Math.round((e.clientX - st.px) / cellW);
      const dy = Math.round((e.clientY - st.py) / BOARD_ROW);
      const box: BoardBox =
        drag.mode === "move"
          ? {
              ...st.box,
              x: Math.max(0, Math.min(BOARD_COLS - st.box.w, st.box.x + dx)),
              y: Math.max(0, st.box.y + dy),
            }
          : {
              ...st.box,
              w: Math.max(st.minW, Math.min(BOARD_COLS - st.box.x, st.box.w + dx)),
              h: Math.max(st.minH, st.box.h + dy),
            };
      setDrag((d) => (d && (d.box.x !== box.x || d.box.y !== box.y || d.box.w !== box.w || d.box.h !== box.h) ? { ...d, box } : d));
    };
    const finish = (commit: boolean) => {
      setDrag((d) => {
        if (d && commit)
          setLayout((cur) => {
            const next = compact(resolve({ ...cur, [d.id]: d.box }, d.id));
            persist(next);
            return next;
          });
        return null;
      });
      startRef.current = null;
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    const cursor = document.body.style.cursor;
    const select = document.body.style.userSelect;
    document.body.style.cursor = drag.mode === "move" ? "grabbing" : "nwse-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.cursor = cursor;
      document.body.style.userSelect = select;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
    };
  }, [drag, cellW, persist]);

  // Live view: merge the in-flight box and resolve, so the board you see IS the
  // board you'd get on release. Idle = the committed (already-resolved) layout.
  const view = useMemo(() => (drag ? resolve({ ...layout, [drag.id]: drag.box }, drag.id) : layout), [drag, layout]);

  const heightPx = Math.max(
    BOARD_ROW * 8,
    ...items.map((it) => {
      const b = view[it.id];
      return b ? (b.y + b.h) * BOARD_ROW : 0;
    }),
  );

  // The guide grid — both axes, because both are real snap units here (columns
  // AND 24px rows). hq paints zinc at 15%/11% over near-black; the light
  // translation is the border token, faint at idle and awake during a drag.
  const lineV = drag ? "var(--color-border)" : "color-mix(in srgb, var(--color-border) 62%, transparent)";
  const lineH = drag ? "color-mix(in srgb, var(--color-border) 80%, transparent)" : "color-mix(in srgb, var(--color-border) 45%, transparent)";

  return (
    <div ref={ref} className={`relative w-full ${className}`} style={{ height: `${heightPx}px` }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-150"
        style={{
          backgroundImage: `linear-gradient(to right, ${lineV} 1px, transparent 1px), linear-gradient(to bottom, ${lineH} 1px, transparent 1px)`,
          backgroundSize: `${cellW}px ${BOARD_ROW}px`,
          opacity: cellW ? 1 : 0,
        }}
      />
      {items.map((it) => {
        const box = view[it.id];
        if (!box || !cellW) return null;
        const dragging = drag?.id === it.id;
        return (
          <div
            key={it.id}
            data-board-card={it.id}
            onPointerDown={(e) => hold(it.id, e)}
            title="Click and hold to drag"
            style={{
              left: box.x * cellW,
              top: box.y * BOARD_ROW,
              width: box.w * cellW,
              height: box.h * BOARD_ROW,
              padding: CELL_PAD,
            }}
            className={
              dragging
                ? "absolute z-20"
                : "absolute z-10 transition-[left,top,width,height] duration-100 ease-out motion-reduce:transition-none"
            }
          >
            <BoardCardContext.Provider
              value={{
                isDragging: dragging,
                grab: (e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  e.stopPropagation();
                  begin(it.id, "move", e);
                },
                resizeStart: (e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  e.stopPropagation();
                  begin(it.id, "resize", e);
                },
              }}
            >
              {renderCard(it.id)}
            </BoardCardContext.Provider>
          </div>
        );
      })}
    </div>
  );
}

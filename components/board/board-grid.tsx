"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

// A board: cards flow in a responsive CSS grid, carry a SIZE STEP, and reorder
// by picking the WHOLE CARD up. hq's fleet-grid (app/ui/fleet-grid.tsx) is the
// feel spec — click-and-hold to engage, grab/grabbing cursors, corner
// affordances that fade in on hover — translated to a flow grid and this
// theme's light surfaces.
//
// Why a flow grid and not hq's absolute-positioned 12-col canvas: hq's grid
// exists to let a card sit anywhere on the canvas, and pays for it with
// collision resolution and a px-height model. A board here needs order + width,
// and a flow grid gets responsive stacking for free.
//
// Generic by construction: this file knows ids, an order, and a size per id.
// What a card CONTAINS is entirely the caller's (renderCard). Nothing here may
// import a feature — see /analytics for the reference composition.

export type BoardCardSize = "sm" | "md" | "lg";

/** Per-card drag state, published by BoardGrid and read by BoardCard. Null
 *  outside a grid — a BoardCard on its own is simply a static card. */
export interface BoardCardDrag {
  isDragging: boolean;
  /** A drag is in flight and this card is the one under the pointer. */
  isOver: boolean;
  /** Pointer-down on the grip: engages the move immediately. */
  grab: (e: ReactPointerEvent) => void;
}
const BoardCardContext = createContext<BoardCardDrag | null>(null);
export const useBoardCardDrag = () => useContext(BoardCardContext);

/** The default ladder: one column, two, then the full four. */
export const BOARD_GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4";
export const BOARD_SPAN: Record<BoardCardSize, string> = {
  sm: "col-span-1",
  md: "col-span-1 sm:col-span-2",
  lg: "col-span-1 sm:col-span-2 xl:col-span-4",
};
export const BOARD_HEIGHT: Record<BoardCardSize, string> = {
  sm: "h-[180px]",
  md: "h-[264px]",
  lg: "h-[340px]",
};

/** The board's reorder rule, as a pure function so every caller agrees: the
 *  card you carried lands on the far side of the card you dropped it on —
 *  after it when you dragged right, before it when you dragged left. (Insert
 *  always-before instead and a drop on your right-hand neighbour is a no-op.) */
export function reorderIds(ids: string[], from: string, to: string): string[] {
  const i = ids.indexOf(from);
  const j = ids.indexOf(to);
  if (i < 0 || j < 0 || i === j) return ids;
  const next = ids.filter((id) => id !== from);
  const at = next.indexOf(to);
  next.splice(i < j ? at + 1 : at, 0, from);
  return next;
}

// Pointer-down on a control never picks the card up: a press that lands on
// something clickable belongs to that thing. This is what lets the whole card
// be the drag surface without stealing the kebab, a link, or an input.
const INTERACTIVE =
  'a, button, input, select, textarea, label, [role="button"], [role="menuitem"], [contenteditable="true"], [data-board-no-drag]';
const HOLD_MS = 150; // hq's engage delay
const SLOP_PX = 4; // …or this much travel, whichever lands first

export function BoardGrid({
  items,
  size = () => "md",
  onReorder,
  renderCard,
  className = BOARD_GRID,
  span = BOARD_SPAN,
  height = BOARD_HEIGHT,
}: {
  /** Card ids, in board order. */
  items: string[];
  /** This id's size step. The caller owns the sizes map and its per-id default. */
  size?: (id: string) => BoardCardSize;
  /** `from` was dropped on `to` — splice `from` in ahead of `to`. */
  onReorder: (from: string, to: string) => void;
  renderCard: (id: string) => ReactNode;
  /** Grid classes. Defaults to the 4-col board. */
  className?: string;
  span?: Record<BoardCardSize, string>;
  height?: Record<BoardCardSize, string>;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const overRef = useRef<string | null>(null);

  // hq's startHold: a press engages the move after a short hold OR as soon as
  // the pointer travels a few px — whichever comes first — so a plain click
  // never nudges the board.
  const hold = useCallback((id: string, e: ReactPointerEvent) => {
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
    function engage() {
      cleanup();
      setDragId(id);
    }
    function move(ev: PointerEvent) {
      if (Math.hypot(ev.clientX - px, ev.clientY - py) > SLOP_PX) engage();
    }
    timer = window.setTimeout(engage, HOLD_MS);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  }, []);

  const grab = useCallback((id: string, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDragId(id);
  }, []);

  // The live drag: track the card under the pointer, commit the reorder on the
  // way up. Window-level so the drag survives leaving the board.
  useEffect(() => {
    if (!dragId) return;
    const move = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const found = el?.closest<HTMLElement>("[data-board-card]")?.dataset.boardCard ?? null;
      const id = found && found !== dragId ? found : null;
      overRef.current = id;
      setOverId(id);
    };
    const finish = (commit: boolean) => {
      const to = overRef.current;
      overRef.current = null;
      setOverId(null);
      setDragId(null);
      if (commit && to) onReorder(dragId, to);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    // The card stays put in a flow grid, so the pointer spends the whole drag
    // over OTHER cards — the grabbing cursor has to come from the document.
    const cursor = document.body.style.cursor;
    const select = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
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
  }, [dragId, onReorder]);

  return (
    <div className={className}>
      {items.map((id) => {
        const s = size(id);
        return (
          <div
            key={id}
            // data-board-card is both the drop hit-test target (elementFromPoint
            // walks up to it) and the hook a browser test drives the board by.
            data-board-card={id}
            onPointerDown={(e) => hold(id, e)}
            title="Click and hold to drag"
            className={`${span[s]} ${height[s]}`}
          >
            <BoardCardContext.Provider
              value={{
                isDragging: dragId === id,
                isOver: overId === id,
                grab: (e) => grab(id, e),
              }}
            >
              {renderCard(id)}
            </BoardCardContext.Provider>
          </div>
        );
      })}
    </div>
  );
}

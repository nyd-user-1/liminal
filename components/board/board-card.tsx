"use client";

import { useRef, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { useBoardCardDrag } from "./board-grid";

// One board card. Anatomy is the /library card (the house quality bar): title
// + kebab on top, body, tidy meta row at the bottom. Inside a BoardGrid it also
// wears hq's affordance pack — the corner icons fade in on hover, the whole
// card is the drag surface, and the body carries the hold-to-drag hint.
//
// The card owns no data and knows no feature: it renders `children` and reports
// interactions (remove / resize) upward.

/** hq's ⠿ grip — six dots, the "pick this up" glyph. Filled, so it stays legible
 *  at 12px where the line-icon set goes muddy. */
function GripGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="8" cy="6" r="1.6" />
      <circle cx="8" cy="12" r="1.6" />
      <circle cx="8" cy="18" r="1.6" />
      <circle cx="16" cy="6" r="1.6" />
      <circle cx="16" cy="12" r="1.6" />
      <circle cx="16" cy="18" r="1.6" />
    </svg>
  );
}

/** The bottom-right resize grip. Drag outward (right/down) to grow a step,
 *  inward to shrink; a plain click cycles like the kebab item. Sizes snap —
 *  there is no freeform preview, so all the handle needs is direction. */
function ResizeHandle({
  onStep,
  onCycle,
  label,
}: {
  onStep?: (dir: 1 | -1) => void;
  onCycle?: () => void;
  label: string;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <span
      role="button"
      aria-label={`Resize ${label}`}
      title="Drag to resize"
      onPointerDown={(e) => {
        e.stopPropagation();
        start.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerUp={(e) => {
        if (!start.current) return;
        const d = e.clientX - start.current.x + (e.clientY - start.current.y);
        start.current = null;
        if (d > 24) onStep?.(1);
        else if (d < -24) onStep?.(-1);
        else onCycle?.();
      }}
      className="absolute bottom-0 right-0 z-10 flex h-5 w-5 cursor-nwse-resize touch-none items-end justify-end p-[3px] opacity-0 transition-opacity focus-visible:opacity-100 group-hover/card:opacity-100"
    >
      <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden className="text-text-muted">
        <path d="M8 1v7H1M8 4.5V8H4.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function BoardCard({
  title,
  titleText,
  menu,
  footer,
  onRemove,
  onResizeStep,
  onResizeCycle,
  label,
  className = "",
  children,
}: {
  title: ReactNode;
  /** Native tooltip for the title, which line-clamps. */
  titleText?: string;
  /** Top-right slot — a KebabMenu, usually. */
  menu?: ReactNode;
  /** The meta row under the body's bottom rule. */
  footer?: ReactNode;
  /** Present ⇒ the × appears at the top-left corner on hover. */
  onRemove?: () => void;
  /** Present ⇒ the resize grip appears at the bottom-right corner on hover. */
  onResizeStep?: (dir: 1 | -1) => void;
  onResizeCycle?: () => void;
  /** Plain-text name of this card, for the affordances' accessible labels. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const drag = useBoardCardDrag();
  const resizable = !!(onResizeStep || onResizeCycle);

  // Quiet by default, a 1px primary edge on hover, and the drop target lights
  // up so it's obvious where the card you're carrying will land. The ! is load
  // bearing: Card ships its own border-border/bg-surface, and an unflagged
  // utility of equal specificity loses to whichever Tailwind emits later.
  const state = drag?.isOver
    ? "!border-primary !bg-primary-wash"
    : drag?.isDragging
      ? "cursor-grabbing !border-primary opacity-40"
      : drag
        ? "cursor-grab hover:border-primary"
        : "hover:border-primary";

  return (
    <Card className={`group/card relative flex h-full min-w-0 select-none flex-col gap-2.5 !p-4 transition-colors ${state} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 text-[15px] font-semibold text-text" title={titleText}>
            {title}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {/* The grip signals that the whole card moves; dragging from it works
              too, and skips the hold. */}
          {drag && (
            <span
              role="button"
              aria-label={`Move ${label}`}
              title="Drag to move"
              onPointerDown={drag.grab}
              className={`touch-none rounded p-1 transition group-hover/card:opacity-100 ${
                drag.isDragging
                  ? "cursor-grabbing bg-canvas text-text opacity-100"
                  : "cursor-grab text-text-muted opacity-0 hover:bg-canvas hover:text-text"
              }`}
            >
              <GripGlyph />
            </span>
          )}
          {menu && (
            <span onClick={(e) => e.stopPropagation()} className="-mr-1.5 -mt-1">
              {menu}
            </span>
          )}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      {footer && <div className="flex items-center justify-between gap-2 border-t border-border pt-2">{footer}</div>}

      {/* × rides the corner rather than sitting inside it (hq's placement would
          land on the title on a light card) — a chip in the grid gutter. */}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          title="Remove from board"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="absolute -left-2 -top-2 z-10 grid h-6 w-6 place-items-center rounded-full border border-border bg-surface text-text-muted opacity-0 shadow-card transition hover:border-danger hover:text-danger focus-visible:opacity-100 group-hover/card:opacity-100"
        >
          <Icon name="x" size={12} />
        </button>
      )}

      {resizable && <ResizeHandle onStep={onResizeStep} onCycle={onResizeCycle} label={label} />}
    </Card>
  );
}

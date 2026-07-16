"use client";

import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icons";

// Catalog `ColumnPicker` — which table columns render. Selection state and
// persistence live with the caller (pass the visible set + onToggle); the
// popover stays open across toggles so several columns can be flipped in one
// visit. Two trigger modes:
//   • chip     (default) — a "Columns" chip you place in a Toolbar.
//   • anchored — pass `at`: no chip renders and the popover opens at those
//     viewport coords. STANDARD for tables: hang it off the header row's
//     right-click (Table's `onHeaderContextMenu`) and the toolbar keeps no
//     chip at all. Anchored mode is position:fixed, so it is not clipped by
//     the Table's own overflow-auto container.

export interface ColumnOption {
  key: string;
  label: string;
}

/** Keep the popover on screen when the click lands near an edge. */
const MENU_W = 224; // w-56
const MENU_MAX_H = 320; // max-h-80

export function ColumnPicker({
  options,
  visible,
  onToggle,
  at,
  onDismiss,
  iconOnly = false,
  className = "",
}: {
  options: ColumnOption[];
  visible: Set<string>;
  onToggle: (key: string) => void;
  /** Chip mode only — drop the label and chevron, keep the button chrome. */
  iconOnly?: boolean;
  /** Cursor-anchored mode: viewport coords, or null when closed. Passing this
   *  prop at all suppresses the chip — the caller owns open/closed. */
  at?: { x: number; y: number } | null;
  /** Anchored mode only — fired on outside click or Escape. */
  onDismiss?: () => void;
  className?: string;
}) {
  const anchored = at !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const open = anchored ? at !== null : selfOpen;
  const ref = useRef<HTMLSpanElement>(null);

  const close = () => (anchored ? onDismiss?.() : setSelfOpen(false));
  // `close` is re-created every render; the listeners only ever call the
  // latest one through this ref, so the effect below stays keyed on `open`.
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = (
    <div
      className={
        anchored
          ? "fixed z-50 max-h-80 w-56 overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-menu"
          : "absolute right-0 top-full z-40 mt-1.5 max-h-80 w-56 overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-menu"
      }
      style={
        anchored && at
          ? {
              left: Math.min(at.x, Math.max(8, window.innerWidth - MENU_W - 8)),
              top: Math.min(at.y, Math.max(8, window.innerHeight - MENU_MAX_H - 8)),
            }
          : undefined
      }
    >
      {options.map((o) => (
        <label
          key={o.key}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-field px-2.5 py-1.5 text-[15px] text-text transition-colors hover:bg-[#F3F4F6]"
        >
          <Checkbox aria-label={`Show ${o.label} column`} checked={visible.has(o.key)} onChange={() => onToggle(o.key)} />
          {o.label}
        </label>
      ))}
    </div>
  );

  return (
    <span ref={ref} className={anchored ? className : `relative ${className}`}>
      {!anchored && (
        <button
          type="button"
          onClick={() => setSelfOpen((o) => !o)}
          aria-label={iconOnly ? "Columns" : undefined}
          // bg-surface so the chip reads as a control on a canvas-filled toolbar,
          // matching FilterChip's unapplied state next to it. Icon-only is a
          // 40px square — the control-height standard, same as SearchInput.
          className={`inline-flex items-center justify-center gap-1.5 rounded-field border border-field-border bg-surface text-sm font-medium text-text-body transition-colors hover:border-field-border-focus ${
            iconOnly ? "h-10 w-10" : "h-8 px-3"
          }`}
        >
          <Icon name="columns-3" size={iconOnly ? 18 : 14} />
          {!iconOnly && "Columns"}
        </button>
      )}
      {open && menu}
    </span>
  );
}

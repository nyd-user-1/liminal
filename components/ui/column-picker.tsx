"use client";

import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icons";

// Catalog `ColumnPicker` — a "Columns" chip opening a checkbox popover that
// controls which table columns render. Selection state and persistence live
// with the caller (pass the visible set + onToggle); the popover stays open
// across toggles so several columns can be flipped in one visit.

export interface ColumnOption {
  key: string;
  label: string;
}

export function ColumnPicker({
  options,
  visible,
  onToggle,
  className = "",
}: {
  options: ColumnOption[];
  visible: Set<string>;
  onToggle: (key: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <span ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-field border border-field-border px-3 py-1.5 text-sm font-medium text-text-body transition-colors hover:border-field-border-focus"
      >
        <Icon name="grid" size={14} />
        Columns
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 max-h-80 w-56 overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-menu">
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
      )}
    </span>
  );
}

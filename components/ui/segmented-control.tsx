"use client";

import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `SegmentedControl` — joined button group; active segment =
// primary fill + white (calendar grid/list view toggle).

export interface Segment {
  value: string;
  label?: string;
  icon?: IconName;
}

export function SegmentedControl({
  segments,
  value,
  onChange,
  className = "",
}: {
  segments: Segment[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex overflow-hidden rounded-field border border-field-border bg-surface ${className}`}>
      {segments.map((s, i) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(s.value)}
            className={`inline-flex h-9 items-center gap-1.5 px-3 text-sm font-medium transition-colors ${
              active ? "bg-primary text-white" : "text-text-body hover:bg-canvas"
            } ${i > 0 ? "border-l border-field-border" : ""}`}
          >
            {s.icon && <Icon name={s.icon} size={16} />}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

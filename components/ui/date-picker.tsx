"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";

// Catalog `DatePicker` — mini month grid: month label + prev/next chevrons,
// S–S header; today = primary-tint circle, selected = solid primary circle.
// Value is a YYYY-MM-DD string (no timezone surprises).

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DatePicker({
  value,
  onChange,
  className = "",
  showMonthNav = true,
}: {
  value?: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  className?: string;
  /** Hide the ‹ › month arrows when an external control drives navigation. */
  showMonthNav?: boolean;
}) {
  const initial = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const first = new Date(viewYear, viewMonth, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayKey = toKey(new Date());

  const shift = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <div className={`w-64 select-none ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[15px] font-semibold text-text">
          {first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        {showMonthNav && (
          <span className="flex">
            <IconButton icon="chevron-left" label="Previous month" onClick={() => shift(-1)} className="h-7 w-7" />
            <IconButton icon="chevron-right" label="Next month" onClick={() => shift(1)} className="h-7 w-7" />
          </span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-xs font-medium text-text-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: startPad }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const key = toKey(new Date(viewYear, viewMonth, i + 1));
          const selected = key === value;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                selected
                  ? "bg-primary font-semibold text-white"
                  : isToday
                    ? "bg-teal-100 font-semibold text-primary"
                    : "text-text-body hover:bg-canvas"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

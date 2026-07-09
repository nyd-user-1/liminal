"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";

// Catalog `DatePicker` — mini month grid: month label + prev/next chevrons,
// M–F header only (no weekend appointments); today = primary-tint circle,
// selected = solid primary circle. Value is a YYYY-MM-DD string (no timezone surprises).
// Optional `enabledDates`: when given, any other day renders struck-through
// and unclickable (booking calendars — days with no open slots).

const WEEKDAYS = ["M", "T", "W", "T", "F"];

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DatePicker({
  value,
  onChange,
  enabledDates,
  className = "",
}: {
  value?: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  enabledDates?: ReadonlySet<string>; // YYYY-MM-DD keys; omit = all days clickable
  className?: string;
}) {
  const initial = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const first = new Date(viewYear, viewMonth, 1);
  const mondayOffset = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
  const startPad = mondayOffset <= 4 ? mondayOffset : 0; // month starting Sat/Sun needs no lead-in
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayKey = toKey(new Date());

  const shift = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <div className={`w-full select-none ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[15px] font-semibold text-text">
          {first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <span className="flex">
          <IconButton icon="chevron-left" label="Previous month" onClick={() => shift(-1)} className="h-7 w-7" />
          <IconButton icon="chevron-right" label="Next month" onClick={() => shift(1)} className="h-7 w-7" />
        </span>
      </div>
      <div className="grid grid-cols-5 gap-y-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-xs font-medium text-text-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: startPad }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const date = new Date(viewYear, viewMonth, i + 1);
          const dow = date.getDay();
          if (dow === 0 || dow === 6) return null; // no weekend appointments
          const key = toKey(date);
          const selected = key === value;
          const isToday = key === todayKey;
          const disabled = enabledDates ? !enabledDates.has(key) : false;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(key)}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                disabled
                  ? "cursor-default text-text-muted/60 line-through"
                  : selected || isToday
                    ? "bg-primary font-semibold text-white hover:bg-primary-hover"
                    : enabledDates
                      ? "font-semibold text-text hover:bg-teal-100 hover:text-primary"
                      : "text-text-body hover:bg-teal-100 hover:text-primary"
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

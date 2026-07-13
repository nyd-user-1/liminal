"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FilterChip } from "@/components/ui/filter-chip";
import { Icon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";

// FilterChip + attached popover — the Clients/Directory toolbar pattern,
// without directory's titleCase (payer names like CDPHP must render as-is).
// Single-select (value/onSelect/onClear) or multi-select (values/onToggle):
// multi keeps the menu open and shows "first +n" in the chip.

export interface ChipOption {
  value: string;
  label: string;
  lead?: ReactNode;
}

export function ChipMenu({
  label,
  options,
  value,
  onSelect,
  values,
  onToggle,
  onClear,
}: {
  label: string;
  options: ChipOption[];
  value?: string;
  onSelect?: (v: string) => void;
  values?: string[];
  onToggle?: (v: string) => void;
  onClear: () => void;
}) {
  const multi = values !== undefined;
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const searchable = options.length > 6;
  const shown =
    searchable && term ? options.filter((o) => o.label.toLowerCase().includes(term.toLowerCase())) : options;

  const chipValue = multi
    ? values.length > 0
      ? `${options.find((o) => o.value === values[0])?.label ?? values[0]}${values.length > 1 ? ` +${values.length - 1}` : ""}`
      : undefined
    : value
      ? (options.find((o) => o.value === value)?.label ?? value)
      : undefined;

  return (
    <span ref={ref} className="relative">
      <FilterChip label={label} value={chipValue} onClick={() => setOpen((o) => !o)} onClear={onClear} />
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-72 rounded-card border border-border bg-surface p-2 shadow-menu">
          {searchable && (
            <SearchInput
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}…`}
              className="mb-1.5 w-full"
            />
          )}
          <div className="max-h-64 overflow-y-auto">
            {shown.map((o) => {
              const selected = multi ? values.includes(o.value) : o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    if (multi) onToggle?.(o.value);
                    else {
                      onSelect?.(o.value);
                      setOpen(false);
                    }
                  }}
                  className={`flex w-full items-center gap-2 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                    selected ? "font-semibold text-primary" : "text-text"
                  }`}
                >
                  {o.lead}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {selected && <Icon name="check" size={16} className="shrink-0 text-primary" />}
                </button>
              );
            })}
            {shown.length === 0 && <p className="px-2.5 py-2 text-sm text-text-muted">No matches</p>}
          </div>
        </div>
      )}
    </span>
  );
}

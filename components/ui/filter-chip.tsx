"use client";

import { Icon } from "@/components/ui/icons";

// Catalog `FilterChip` — pill in the table filter bar.
// add state: "+ Status" outline · applied: label + value + clear ×, tinted.
// A shared min-width + centered content keeps chips uniform regardless of label.

export function FilterChip({
  label,
  value,
  onClick,
  onClear,
  className = "",
}: {
  label: string;
  value?: string; // set → applied state
  onClick?: () => void;
  onClear?: () => void;
  className?: string;
}) {
  const applied = value !== undefined && value !== "";
  return (
    <span
      className={`inline-flex min-w-[7rem] items-center justify-center overflow-hidden rounded-full border text-sm font-medium transition-colors ${
        applied ? "border-primary-weak bg-teal-100 text-primary" : "border-field-border bg-surface text-text-body hover:border-primary"
      } ${className}`}
    >
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 py-1.5 pl-3 pr-2">
        {!applied && <Icon name="plus" size={14} />}
        {label}
        {applied && <span className="font-semibold">· {value}</span>}
      </button>
      {applied && onClear && (
        <button type="button" onClick={onClear} aria-label={`Clear ${label} filter`} className="pr-2.5 opacity-60 hover:opacity-100">
          <Icon name="x" size={14} />
        </button>
      )}
    </span>
  );
}

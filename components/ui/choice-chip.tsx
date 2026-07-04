"use client";

import { Icon } from "@/components/ui/icons";

// Catalog `ChoiceChip` — compact selectable option in a wrap grid;
// selected = teal tint + ✓. Single-select groups.

export function ChoiceChip({
  label,
  selected,
  onSelect,
  className = "",
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        selected
          ? "border-primary bg-teal-100 text-primary"
          : "border-field-border bg-surface text-text-body hover:border-primary"
      } ${className}`}
    >
      {selected && <Icon name="check" size={14} />}
      {label}
    </button>
  );
}

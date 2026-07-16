"use client";

import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `FilterChip` — pill in the table filter bar.
// add state: "+ Status" outline · applied: label + value + clear ×, tinted.
// A shared min-width + centered content keeps chips uniform regardless of label.
// `icon` overrides the leading glyph for chips that name the ACTION rather than
// the field (a generic "Filter" wants list-filter, not a plus).

export function FilterChip({
  label,
  value,
  onClick,
  onClear,
  icon = "plus",
  iconOnly = false,
  className = "",
}: {
  label: string;
  value?: string; // set → applied state
  onClick?: () => void;
  onClear?: () => void;
  /** Leading glyph in the unapplied state. */
  icon?: IconName;
  /** Glyph only — no label, no chevron, no value. The applied TINT is then the
   *  only cue a filter is on, so the label rides `title`/aria for the rest. */
  iconOnly?: boolean;
  className?: string;
}) {
  const applied = value !== undefined && value !== "";
  return (
    <span
      // Sizing rides the BORDERED element (border-box), so icon-only is exactly
      // 40px like the Columns button — putting h-10 on the inner button instead
      // would add the border on top and render 42.
      className={`inline-flex items-center justify-center overflow-hidden rounded-field border text-sm font-medium transition-colors ${
        iconOnly ? (applied ? "h-10" : "h-10 w-10") : "h-8 min-w-[7rem]"
      } ${
        applied ? "border-primary-weak bg-teal-100 text-primary" : "border-field-border bg-surface text-text-body hover:border-primary"
      } ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={iconOnly ? (applied ? `${label}: ${value}` : label) : undefined}
        title={iconOnly && applied ? `${label}: ${value}` : undefined}
        // Fills the span, which owns the 40px box.
        className={`inline-flex items-center justify-center gap-1 ${
          iconOnly ? `h-full ${applied ? "pl-2.5" : "w-full"}` : "py-1.5 pl-3 pr-2"
        }`}
      >
        {(iconOnly || !applied) && <Icon name={icon} size={iconOnly ? 18 : 14} />}
        {!iconOnly && label}
        {!iconOnly && applied && <span className="font-semibold">· {value}</span>}
      </button>
      {applied && onClear && (
        <button type="button" onClick={onClear} aria-label={`Clear ${label} filter`} className="pr-2.5 opacity-60 hover:opacity-100">
          <Icon name="x" size={14} />
        </button>
      )}
    </span>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type SelectHTMLAttributes } from "react";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";

// Catalog `Select` — Field-like trigger with trailing chevron.
// Default = styled native <select>. `searchable` = custom trigger opening a
// filterable option list (catalog "searchable" variant).

export interface SelectOption {
  value: string;
  label: string;
  /** Optional leading color dot (catalog `withColorDot`, keys services). */
  color?: string;
}

const triggerClass =
  "h-11 w-full rounded-field border border-field-border bg-surface px-3 text-left text-[15px] text-text outline-none transition-colors focus:border-field-border-focus disabled:bg-[#E5E7EB] disabled:text-text-muted";

export function Select({
  label,
  required,
  hint,
  error,
  options,
  searchable,
  placeholder,
  value,
  onValueChange,
  id,
  className = "",
  ...rest
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  options: SelectOption[];
  searchable?: boolean;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value">) {
  const inputId = id ?? rest.name;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(
    () => (query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options),
    [options, query],
  );

  const dot = (color?: string) =>
    color ? <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} /> : null;

  const body = searchable ? (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        id={inputId}
        disabled={rest.disabled}
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
        }}
        className={`flex items-center justify-between gap-2 ${triggerClass} ${error ? "border-danger" : ""}`}
      >
        <span className={value ? "" : "text-text-muted"}>
          {value ? (
            <>
              {dot(options.find((o) => o.value === value)?.color)}
              {options.find((o) => o.value === value)?.label ?? value}
            </>
          ) : (
            (placeholder ?? "Select…")
          )}
        </span>
        <Icon name="chevron-down" size={16} className="shrink-0 text-text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-card border border-border bg-surface p-2 shadow-menu">
          <div className="flex items-center gap-2 rounded-field border border-field-border px-2.5">
            <Icon name="search" size={16} className="text-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-muted"
            />
          </div>
          <div className="mt-1 max-h-56 overflow-y-auto">
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onValueChange?.(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${o.value === value ? "font-semibold text-primary" : "text-text"}`}
              >
                {dot(o.color)}
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-2.5 py-2 text-sm text-text-muted">No matches</p>}
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="relative">
      <select
        id={inputId}
        value={value}
        onChange={(e) => {
          onValueChange?.(e.target.value);
          rest.onChange?.(e);
        }}
        className={`appearance-none pr-9 ${triggerClass} ${error ? "border-danger" : ""} ${value === "" || value === undefined ? "text-text-muted" : ""}`}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevron-down"
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
      />
    </div>
  );

  return (
    <div className={className}>
      {label && (
        <FieldLabel htmlFor={inputId} required={required}>
          {label}
        </FieldLabel>
      )}
      {body}
      {error ? <FieldError>{error}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

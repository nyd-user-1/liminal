"use client";

import { useEffect, useMemo, useRef, useState, type SelectHTMLAttributes } from "react";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";

// Catalog `Select` — Field-like trigger with trailing chevron opening a
// custom portable dropdown (never the OS-native <select>), styled to match
// DropdownMenu / KebabMenu: rounded-card menu, hover row, teal selected + check.
// `searchable` adds a filter input; options render a leading color dot only
// when `option.color` is set.

export interface SelectOption {
  value: string;
  label: string;
  /** Optional leading color dot (catalog `withColorDot`, keys services). */
  color?: string;
}

const triggerClass =
  "h-10 w-full min-w-[180px] rounded-field border border-field-border bg-surface px-3 text-left text-[15px] text-text outline-none transition-colors focus:border-field-border-focus disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-text-muted";

function Dot({ color }: { color?: string }) {
  if (!color) return null;
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />;
}

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
    () => (searchable && query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options),
    [options, query, searchable],
  );

  const selected = options.find((o) => o.value === value);

  return (
    <div className={className}>
      {label && (
        <FieldLabel htmlFor={inputId} required={required}>
          {label}
        </FieldLabel>
      )}
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          id={inputId}
          disabled={rest.disabled}
          aria-label={rest["aria-label"]}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
            setQuery("");
          }}
          className={`flex items-center justify-between gap-2 ${triggerClass} ${error ? "border-danger" : ""}`}
        >
          <span className={`flex min-w-0 items-center gap-2 ${value ? "" : "text-text-muted"}`}>
            <Dot color={selected?.color} />
            <span className="truncate">{value ? (selected?.label ?? value) : (placeholder ?? "Select…")}</span>
          </span>
          <Icon name="chevron-down" size={16} className="shrink-0 text-text-muted" />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-card border border-border bg-surface p-2 shadow-menu">
            {searchable && (
              <div className="mb-1 flex items-center gap-2 rounded-field border border-field-border px-2.5">
                <Icon name="search" size={16} className="text-text-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-muted"
                />
              </div>
            )}
            <div className="max-h-60 overflow-y-auto" role="listbox">
              {filtered.map((o) => {
                const isSel = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => {
                      onValueChange?.(o.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-field px-2.5 py-2 text-left text-[15px] font-medium transition-colors hover:bg-[#F3F4F6] ${isSel ? "text-primary" : "text-text"}`}
                  >
                    <Dot color={o.color} />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {isSel && <Icon name="check" size={16} className="shrink-0 text-primary" />}
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="px-2.5 py-2 text-sm text-text-muted">No matches</p>}
            </div>
          </div>
        )}
      </div>

      {/* Carry the value for native form posts (uncontrolled name= usage). */}
      {rest.name && <input type="hidden" name={rest.name} value={value ?? ""} />}

      {error ? <FieldError>{error}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

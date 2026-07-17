"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FilterChip } from "@/components/ui/filter-chip";
import { Icon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";

// Two-level filter menu — the dimension first, its values behind it. One flat
// row of chips ("Insurer", "Plan", "Code" …) makes the toolbar a wall of
// controls; this collapses them into a single "Filter" button whose menu leads
// with the category and opens its values as a searchable submenu.
//
// Promoted from the local copy in clients-table.tsx (categories → hover
// submenu) and merged with the rates ChipMenu's searchable value list, so the
// second level is filterable when a category runs long. One active value PER
// category (Insurer=Cigna AND Code=90791 at once), which the single-selection
// original couldn't express.
//
// Composes FilterChip + SearchInput + Icon — no new visual language.

export interface FilterMenuOption {
  value: string;
  label: string;
  /** Leading glyph — an insurer mark, a status dot. */
  lead?: ReactNode;
}
export interface FilterMenuCategory {
  key: string;
  label: string;
  options: FilterMenuOption[];
}

/** Above this many options a category's submenu grows a search box. */
const SEARCH_THRESHOLD = 6;

export function FilterMenu({
  categories,
  selected,
  onSelect,
  label = "Filter",
}: {
  categories: FilterMenuCategory[];
  /** The active value per category key; a key absent/undefined = unset. */
  selected: Record<string, string | undefined>;
  /** Set (or clear, with `undefined`) one category's value. */
  onSelect: (categoryKey: string, value: string | undefined) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  // Reset the transient submenu + its search whenever the menu or the open
  // category changes, so a category never opens pre-filtered by a stale term.
  useEffect(() => {
    if (!open) setOpenCat(null);
  }, [open]);
  useEffect(() => setTerm(""), [openCat]);

  const active = categories
    .map((c) => ({ c, v: selected[c.key] }))
    .filter((x) => x.v !== undefined && x.v !== "");
  // The chip reads the single active value when there's one, a count when
  // several — the same summary the standalone chips gave, in one control.
  const chipValue =
    active.length === 0
      ? undefined
      : active.length === 1
        ? (active[0].c.options.find((o) => o.value === active[0].v)?.label ?? active[0].v)
        : `${active.length} filters`;

  return (
    <span ref={ref} className="relative">
      <FilterChip
        label={label}
        icon="list-filter"
        value={chipValue}
        onClick={() => setOpen((o) => !o)}
        onClear={() => active.forEach((x) => onSelect(x.c.key, undefined))}
      />
      {open && (
        <div
          className="absolute left-0 top-full z-40 mt-1.5 w-56 rounded-card border border-border bg-surface p-1.5 shadow-menu"
          onMouseLeave={() => setOpenCat(null)}
        >
          {categories.map((cat) => {
            const isOpen = openCat === cat.key;
            const catValue = selected[cat.key];
            const searchable = cat.options.length > SEARCH_THRESHOLD;
            const shown =
              searchable && term
                ? cat.options.filter((o) => o.label.toLowerCase().includes(term.toLowerCase()))
                : cat.options;
            const activeLabel = catValue
              ? (cat.options.find((o) => o.value === catValue)?.label ?? catValue)
              : undefined;
            return (
              <div key={cat.key} className="relative" onMouseEnter={() => setOpenCat(cat.key)}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors ${
                    isOpen ? "bg-[#F3F4F6] text-text" : "text-text"
                  }`}
                >
                  <span className="shrink-0">{cat.label}</span>
                  {/* The active value rides on the category row, so the reader
                      sees what's applied without opening every submenu. */}
                  {activeLabel && (
                    <span className="min-w-0 flex-1 truncate text-right text-[13px] font-medium text-primary">
                      {activeLabel}
                    </span>
                  )}
                  <Icon name="chevron-right" size={14} className={`shrink-0 text-text-muted ${activeLabel ? "" : "ml-auto"}`} />
                </button>
                {isOpen && cat.options.length > 0 && (
                  <div className="absolute left-full top-0 z-50 ml-1 w-64 rounded-card border border-border bg-surface p-2 shadow-menu">
                    {searchable && (
                      <SearchInput
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder={`Filter ${cat.label.toLowerCase()}…`}
                        className="mb-1.5 w-full"
                      />
                    )}
                    <div className="max-h-64 overflow-y-auto">
                      {shown.map((o) => {
                        const isSel = catValue === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => {
                              // Clicking the active value clears it — the row is a toggle.
                              onSelect(cat.key, isSel ? undefined : o.value);
                              setOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                              isSel ? "font-semibold text-primary" : "text-text"
                            }`}
                          >
                            {o.lead}
                            <span className="min-w-0 flex-1 truncate">{o.label}</span>
                            {isSel && <Icon name="check" size={16} className="shrink-0 text-primary" />}
                          </button>
                        );
                      })}
                      {shown.length === 0 && <p className="px-2.5 py-2 text-sm text-text-muted">No matches</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}

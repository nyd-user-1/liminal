"use client";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { BASE_INSURANCE_OPTIONS } from "@/lib/insurance-options";

// The find-care search control, as one grouped unit: query field + Search
// button, the four filter dropdowns beneath it, and the insurance footnote.
// Search and filters read as a single instrument, so they're one bordered
// surface rather than three loose rows.
//
// Callers own the state (find-care runs a live search off it; the provider
// page routes to /providers with it) and own the sticky wrapper — this
// component only draws the group. Filter dropdowns use Select's `primary`
// tone: teal trigger label and teal option rows, so each field reads as a
// live filter rather than an empty form input.

// Care-type filter — "Medication Mgmt." ≈ psychiatrist/PMHNP roles, "Talk
// Therapy" ≈ therapist roles (see matchesType in the public-search API route).
// Talk Therapy is preselected, per Brendan: it's what most people arriving at
// /providers are after. "Any care type" widens back out to the full directory.
export const TYPE_OPTIONS = [
  { value: "", label: "Any care type" },
  { value: "psychiatrist", label: "Medication Mgmt." },
  { value: "therapist", label: "Talk Therapy" },
];

// Insurance options are DATA-DRIVEN: server pages build them from
// listPayerFacets() (payers with real ingested network rows — value is the
// payer slug) on top of BASE_INSURANCE_OPTIONS (lib/insurance-options.ts,
// shared here as the no-prop default).

export type CareFilters = {
  q: string;
  type: string;
  city: string;
  specialty: string;
  insurance: string;
};

export type CareFacets = {
  cities: string[];
  counties: string[];
  professions: string[];
  subspecialties: string[];
};

export const EMPTY_FILTERS: CareFilters = {
  q: "",
  type: "therapist",
  city: "",
  specialty: "",
  insurance: "",
};

export function CareSearchGroup({
  facets,
  filters,
  onChange,
  onSubmit,
  collapsed = false,
  className = "",
  insuranceOptions = BASE_INSURANCE_OPTIONS,
}: {
  facets: CareFacets;
  filters: CareFilters;
  /** Called on every field edit; a dropdown change should re-run the search. */
  onChange: (next: CareFilters) => void;
  /** Search button / Enter in the query field. */
  onSubmit: () => void;
  /** Animates the filter row + footnote out, leaving just the search input.
      Driven by scroll direction in find-care-search.tsx. */
  collapsed?: boolean;
  className?: string;
  /** Data-driven payer options (see BASE_INSURANCE_OPTIONS note above). */
  insuranceOptions?: Array<{ value: string; label: string }>;
}) {
  const set = <K extends keyof CareFilters>(key: K, value: CareFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const cityOptions = [{ value: "", label: "Any city" }, ...facets.cities.map((c) => ({ value: c, label: c }))];
  const specialtyOptions = [
    { value: "", label: "Any specialty" },
    ...facets.subspecialties.map((s) => ({ value: s, label: s })),
  ];

  return (
    <div className={`rounded-card border border-page-edge bg-surface p-4 shadow-card ${className}`}>
      <div className="relative">
        <SearchInput
          className="[&_input]:h-14 [&_input]:pr-28 [&_input]:text-base [&_svg]:fill-primary-wash [&_svg]:text-text"
          placeholder="Search by name, specialty, or program…"
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
        <Button size="md" onClick={onSubmit} className="absolute right-2 top-1/2 -translate-y-1/2">
          Search
        </Button>
      </div>

      {/* `grid-rows-[1fr]` → `[0fr]` is the CSS trick for animating to/from
          auto height without hardcoding a max-height guess. `mt-0`/`mt-3` is
          folded into the same transition so the card's own height (and the
          border/padding around it) contracts smoothly to just the search
          row, rather than leaving a dangling gap. */}
      <div
        className={`grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out ${
          collapsed ? "mt-0 grid-rows-[0fr] opacity-0" : "mt-3 grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="overflow-hidden">
          {/* Care type gets the wider column — "Medication Mgmt." doesn't
              fit a quarter of this row, and an ellipsised filter label is
              useless. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.35fr_1fr_1fr_1fr]">
            <Select
              tone="primary"
              options={TYPE_OPTIONS}
              value={filters.type}
              onValueChange={(v) => set("type", v)}
              placeholder="Care type"
              aria-label="Care type"
            />
            <Select
              tone="primary"
              options={cityOptions}
              value={filters.city}
              onValueChange={(v) => set("city", v)}
              searchable
              placeholder="City"
              aria-label="City"
            />
            <Select
              tone="primary"
              options={specialtyOptions}
              value={filters.specialty}
              onValueChange={(v) => set("specialty", v)}
              searchable
              placeholder="Specialty"
              aria-label="Specialty"
            />
            <Select
              tone="primary"
              options={insuranceOptions}
              value={filters.insurance}
              onValueChange={(v) => set("insurance", v)}
              placeholder="Insurance"
              aria-label="Insurance"
            />
          </div>

          <p className="mt-2 text-xs text-text-muted">
            In-network status comes from each insurer&apos;s published directory
            {(() => {
              const payers = insuranceOptions.filter((o) => o.value && o.value !== "Medicaid").map((o) => o.label);
              return payers.length ? ` (${payers.join(", ")} so far)` : "";
            })()}
            ; every New York directory provider is Medicaid-enrolled.
          </p>
        </div>
      </div>
    </div>
  );
}

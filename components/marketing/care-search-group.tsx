"use client";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";

// The find-care search control, as one grouped unit: query field + Search
// button, the four filter dropdowns beneath it, and the insurance footnote.
// Search and filters read as a single instrument, so they're one bordered
// surface rather than three loose rows.
//
// Callers own the state (find-care runs a live search off it; the provider
// page routes to /find-care with it) and own the sticky wrapper — this
// component only draws the group. Filter dropdowns use Select's `primary`
// tone: teal trigger label and teal option rows, so each field reads as a
// live filter rather than an empty form input.

// Care-type filter — "Medication" ≈ psychiatrist/PMHNP roles, "Therapy" ≈
// therapist roles (see matchesType in the public-search API route). Unset by
// default: /find-care opens on the whole directory, and every filter narrows
// from there rather than the page arriving pre-narrowed to prescribers.
export const TYPE_OPTIONS = [
  { value: "", label: "Any care type" },
  { value: "psychiatrist", label: "Medication" },
  { value: "therapist", label: "Therapy" },
];

// The payers Liminal's own practitioners actually carry, plus Medicaid — true
// of every NY directory row by construction (see the note below the filters).
export const INSURANCE_OPTIONS = [
  { value: "", label: "Any insurance" },
  { value: "Medicaid", label: "Medicaid" },
  { value: "Aetna", label: "Aetna" },
  { value: "Cigna", label: "Cigna" },
  { value: "UnitedHealthcare", label: "UnitedHealthcare" },
  { value: "Empire BCBS", label: "Empire BCBS" },
  { value: "Fidelis Care", label: "Fidelis Care" },
  { value: "Healthfirst", label: "Healthfirst" },
  { value: "Oxford", label: "Oxford" },
];

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
  type: "",
  city: "",
  specialty: "",
  insurance: "",
};

export function CareSearchGroup({
  facets,
  filters,
  onChange,
  onSubmit,
  className = "",
}: {
  facets: CareFacets;
  filters: CareFilters;
  /** Called on every field edit; a dropdown change should re-run the search. */
  onChange: (next: CareFilters) => void;
  /** Search button / Enter in the query field. */
  onSubmit: () => void;
  className?: string;
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

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
          options={INSURANCE_OPTIONS}
          value={filters.insurance}
          onValueChange={(v) => set("insurance", v)}
          placeholder="Insurance"
          aria-label="Insurance"
        />
      </div>

      <p className="mt-2 text-xs text-text-muted">
        Insurance shown for Liminal providers; New York directory providers are Medicaid-enrolled.
      </p>
    </div>
  );
}

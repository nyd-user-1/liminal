"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CareSearchGroup,
  EMPTY_FILTERS,
  type CareFacets,
  type CareFilters,
} from "@/components/marketing/care-search-group";

// The same search group /providers runs its live search from, mounted at the
// top of a provider profile. There's nothing to search *on this page*, so it
// hands off: any dropdown change or Search press navigates to /providers with
// the filters applied. An untouched group carries no query string at all, so a
// bare Search lands on the unfiltered directory.

export function ProviderPageSearch({ facets }: { facets: CareFacets }) {
  const router = useRouter();
  const [filters, setFilters] = useState<CareFilters>(EMPTY_FILTERS);

  const go = (f: CareFilters) => {
    const params = new URLSearchParams();
    if (f.q.trim()) params.set("q", f.q.trim());
    if (f.city) params.set("city", f.city);
    if (f.specialty) params.set("specialty", f.specialty);
    if (f.insurance) params.set("insurance", f.insurance);
    if (f.type) params.set("type", f.type);
    router.push(`/providers${params.size ? `?${params}` : ""}`);
  };

  return (
    <CareSearchGroup
      facets={facets}
      filters={filters}
      onChange={(next) => {
        setFilters(next);
        // A dropdown commits immediately; typing in the query field doesn't.
        if (next.q === filters.q) go(next);
      }}
      onSubmit={() => go(filters)}
    />
  );
}

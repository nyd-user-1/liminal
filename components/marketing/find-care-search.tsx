"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { FindCareSpotlightCard } from "@/components/marketing/provider-spotlight-card";
import type { PublicResult } from "@/app/api/directory/public-search/route";

// Care-type filter — first of the inline filter row (Grow-style: plain
// dropdowns, no "All"). "Medication" ≈ psychiatrist/PMHNP roles, "Therapy" ≈
// therapist roles (see matchesType in the public-search API route).
const TYPE_OPTIONS = [
  { value: "psychiatrist", label: "Medication" },
  { value: "therapist", label: "Therapy" },
];

// The payers Liminal's own practitioners actually carry (real content, Task 1),
// plus Medicaid — true of every NY directory row by construction (see the
// insurance note rendered below the filters).
const INSURANCE_OPTIONS = [
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

const PAGE_SIZE = 20;

export function FindCareSearch({
  initialQ = "",
  initialCity = "",
  initialSpecialty = "",
  facets,
}: {
  initialQ?: string;
  initialCity?: string;
  initialSpecialty?: string;
  facets: { cities: string[]; counties: string[]; professions: string[]; subspecialties: string[] };
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [city, setCity] = useState(initialCity);
  const [specialty, setSpecialty] = useState(initialSpecialty);
  const [type, setType] = useState(TYPE_OPTIONS[0].value);
  const [insurance, setInsurance] = useState("");

  const [results, setResults] = useState<PublicResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [searched, setSearched] = useState(false);

  const cityOptions = [{ value: "", label: "Any city" }, ...facets.cities.map((c) => ({ value: c, label: c }))];
  const specialtyOptions = [
    { value: "", label: "Any specialty" },
    ...facets.subspecialties.map((s) => ({ value: s, label: s })),
  ];

  const run = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setSearched(true);
      setError(false);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (city) params.set("city", city);
      if (specialty) params.set("specialty", specialty);
      if (type) params.set("type", type);
      if (insurance) params.set("insurance", insurance);
      params.set("page", String(targetPage));
      params.set("pageSize", String(PAGE_SIZE));
      try {
        const res = await fetch(`/api/directory/public-search?${params.toString()}`);
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        setResults(data.results ?? []);
        setTotal(data.total ?? 0);
        setPage(data.page ?? targetPage);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [q, city, specialty, type, insurance],
  );

  // First load, only if the URL already carries a query or filter.
  useEffect(() => {
    if (initialQ || initialCity || initialSpecialty) run(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any filter change (not a page change) resets to page 1 and re-runs.
  useEffect(() => {
    if (searched) run(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, specialty, type, insurance]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const bookableMatches = results.filter((r) => r.bookable);
  const showFunnelCard = !loading && !error && searched && bookableMatches.length === 0;

  return (
    <div className="mx-auto max-w-[704px]">
      <div className="relative">
        <SearchInput
          className="[&_input]:h-14 [&_input]:pr-28 [&_input]:text-base [&_input]:shadow-card [&_svg]:fill-primary-wash [&_svg]:text-text"
          placeholder="Search by name, specialty, or program…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(1)}
        />
        <Button size="md" onClick={() => run(1)} className="absolute right-2 top-1/2 -translate-y-1/2">
          Search
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select options={TYPE_OPTIONS} value={type} onValueChange={setType} aria-label="Care type" />
        <Select options={cityOptions} value={city} onValueChange={setCity} searchable placeholder="City" aria-label="City" />
        <Select
          options={specialtyOptions}
          value={specialty}
          onValueChange={setSpecialty}
          searchable
          placeholder="Specialty"
          aria-label="Specialty"
        />
        <Select options={INSURANCE_OPTIONS} value={insurance} onValueChange={setInsurance} placeholder="Insurance" aria-label="Insurance" />
      </div>
      <p className="mt-2 text-xs text-text-muted">
        Insurance shown for Liminal providers; New York directory providers are Medicaid-enrolled.
      </p>

      <div className="mt-8">
        {loading && (
          <div className="flex items-center justify-center py-16 text-text-muted">
            <Spinner size={24} />
          </div>
        )}

        {!loading && error && (
          <Banner
            variant="danger"
            action={
              <Button size="sm" onClick={() => run(page)}>
                Try again
              </Button>
            }
          >
            Something went wrong loading results.
          </Banner>
        )}

        {!loading && !error && searched && results.length === 0 && (
          <EmptyState icon="search" title="No matches" subtext="Try a different name, specialty, or clear a filter." />
        )}

        {!loading && !error && searched && results.length > 0 && (
          <>
            <p className="mb-4 text-sm text-text-muted">
              {total.toLocaleString()} {total === 1 ? "provider" : "providers"} found
              {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
            </p>
            <div className="grid grid-cols-1 gap-4">
              {results.map((r) => (
                <FindCareSpotlightCard key={`${r.kind}-${r.id}`} r={r} />
              ))}

              {showFunnelCard && (
                <Card className="border-primary/30 bg-teal-100/40">
                  <div className="flex h-full flex-col justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-text">Prefer to book directly?</h3>
                      <p className="mt-1 text-sm text-text-body">
                        Liminal clinicians offer in-person and telehealth visits, usually within a week.
                      </p>
                    </div>
                    <Button fullWidth onClick={() => router.push("/book/liminal")}>
                      Book with Liminal
                    </Button>
                  </div>
                </Card>
              )}
            </div>

            {pageCount > 1 && <Pagination page={page} pageCount={pageCount} onPageChange={(p) => run(p)} className="mt-6" />}
          </>
        )}

        {!searched && (
          <p className="py-16 text-center text-text-muted">
            Search {"8,500+"} licensed providers and {"6,400+"} mental-health programs across New York.
          </p>
        )}
      </div>
    </div>
  );
}

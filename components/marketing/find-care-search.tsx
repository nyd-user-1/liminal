"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tag } from "@/components/ui/tag";
import type { PublicResult } from "@/app/api/directory/public-search/route";

const COUNTIES = [
  { value: "", label: "All boroughs" },
  { value: "New York", label: "Manhattan" },
  { value: "Kings", label: "Brooklyn" },
  { value: "Queens", label: "Queens" },
  { value: "Bronx", label: "Bronx" },
  { value: "Richmond", label: "Staten Island" },
];

const TYPES = [
  { label: "All", value: "" },
  { label: "Therapist", value: "therapist" },
  { label: "Psychiatrist", value: "psychiatrist" },
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
  initialCounty = "",
  initialCity = "",
  initialSpecialty = "",
  facets,
}: {
  initialQ?: string;
  initialCounty?: string;
  initialCity?: string;
  initialSpecialty?: string;
  facets: { cities: string[]; counties: string[]; professions: string[]; subspecialties: string[] };
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [county, setCounty] = useState(initialCounty);
  const [city, setCity] = useState(initialCity);
  const [specialty, setSpecialty] = useState(initialSpecialty);
  const [type, setType] = useState("");
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
      if (county) params.set("county", county);
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
    [q, county, city, specialty, type, insurance],
  );

  // First load, only if the URL already carries a query or filter.
  useEffect(() => {
    if (initialQ || initialCounty || initialCity || initialSpecialty) run(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any filter change (not a page change) resets to page 1 and re-runs.
  useEffect(() => {
    if (searched) run(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [county, city, specialty, type, insurance]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const bookableMatches = results.filter((r) => r.bookable);
  const showFunnelCard = !loading && !error && searched && bookableMatches.length === 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <SearchInput
            placeholder="Search by name, specialty, or program…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(1)}
          />
        </div>
        <Button onClick={() => run(1)}>Search</Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Select options={COUNTIES} value={county} onValueChange={setCounty} aria-label="Borough" />
        <Select options={cityOptions} value={city} onValueChange={setCity} searchable aria-label="City" />
        <Select options={specialtyOptions} value={specialty} onValueChange={setSpecialty} searchable aria-label="Specialty" />
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <ChoiceChip key={t.label} label={t.label} selected={type === t.value} onSelect={() => setType(t.value)} />
          ))}
        </div>
        <Select options={INSURANCE_OPTIONS} value={insurance} onValueChange={setInsurance} className="sm:w-56" aria-label="Insurance" />
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
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map((r) => {
                const card = (
                  <Card className={r.bookable ? "border-primary/30" : ""}>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-primary">
                        <Icon name={r.kind === "provider" ? "person-circle" : "globe"} size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold text-text">{r.name}</h3>
                          {r.bookable && <Tag hue="teal">Bookable now</Tag>}
                        </div>
                        {r.subtitle && <p className="text-sm text-text-body">{titleCase(r.subtitle)}</p>}
                        {r.agency && <p className="truncate text-sm text-text-muted">{r.agency}</p>}
                        <p className="mt-1 text-sm text-text-muted">
                          {[r.county, r.phone].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
                if (r.kind === "provider" && r.slug) {
                  return (
                    <Link
                      key={`${r.kind}-${r.id}`}
                      href={`/providers/${r.slug}`}
                      className="block transition-transform hover:-translate-y-0.5"
                    >
                      {card}
                    </Link>
                  );
                }
                return <div key={`${r.kind}-${r.id}`}>{card}</div>;
              })}

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

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bMhotrs\b/i, "MHOTRS");
}

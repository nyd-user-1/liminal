"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Icon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { PublicResult } from "@/app/api/directory/public-search/route";

const COUNTIES = [
  { value: "", label: "All boroughs" },
  { value: "New York", label: "Manhattan" },
  { value: "Kings", label: "Brooklyn" },
  { value: "Queens", label: "Queens" },
  { value: "Bronx", label: "Bronx" },
  { value: "Richmond", label: "Staten Island" },
];

const NEEDS = [
  { label: "All", value: "" },
  { label: "Psychologist", value: "CLINICAL PSYCHOLOGIST" },
  { label: "Social worker", value: "CLINICAL SOCIAL WORKER" },
  { label: "Counselor", value: "MENTAL HEALTH COUNSELORS" },
  { label: "Therapist", value: "MARRIAGE & FAMILY THERAPIST" },
];

export function FindCareSearch({ initialQ = "" }: { initialQ?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [county, setCounty] = useState("");
  const [need, setNeed] = useState("");
  const [results, setResults] = useState<PublicResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (county) params.set("county", county);
    if (need) params.set("need", need);
    try {
      const res = await fetch(`/api/directory/public-search?${params.toString()}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, county, need]);

  // Auto-run on first load if an initial query came in, and whenever a
  // filter chip / county changes.
  useEffect(() => {
    if (initialQ) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (searched) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [county, need]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <SearchInput
            placeholder="Search by name, specialty, or program…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
          />
        </div>
        <Select
          options={COUNTIES}
          value={county}
          onValueChange={setCounty}
          className="sm:w-48"
          aria-label="Borough"
        />
        <Button onClick={run}>Search</Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {NEEDS.map((n) => (
          <ChoiceChip key={n.label} label={n.label} selected={need === n.value} onSelect={() => setNeed(n.value)} />
        ))}
      </div>

      <div className="mt-8">
        {loading && (
          <div className="flex items-center justify-center py-16 text-text-muted">
            <Spinner size={24} />
          </div>
        )}

        {!loading && searched && (
          <>
            <p className="mb-4 text-sm text-text-muted">
              {results.length} {results.length === 1 ? "match" : "matches"}
              {results.length === 50 ? " (showing first 50)" : ""}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map((r) => (
                <Card key={`${r.kind}-${r.id}`}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-primary">
                      <Icon name={r.kind === "provider" ? "person-circle" : "globe"} size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-text">{r.name}</h3>
                      {r.subtitle && <p className="text-sm text-text-body">{titleCase(r.subtitle)}</p>}
                      {r.agency && <p className="truncate text-sm text-text-muted">{r.agency}</p>}
                      <p className="mt-1 text-sm text-text-muted">
                        {[r.county, r.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Always-present funnel card */}
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
            </div>
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

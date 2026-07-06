"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";
import type { DirectoryProgram } from "@/lib/types";

export function ResourcesList({
  initial,
  categories,
}: {
  initial: DirectoryProgram[];
  categories: string[];
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [programs, setPrograms] = useState<DirectoryProgram[]>(initial);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category) params.set("category", category);
    try {
      const res = await fetch(`/api/directory/portal-programs?${params.toString()}`);
      const data = await res.json();
      setPrograms(data.programs ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, category]);

  // Re-query when the category chip changes; debounce free-text search.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-text-body">
        Community mental-health programs across the five boroughs — outpatient clinics, crisis support, peer services,
        and more. Reach out to any program directly.
      </p>

      <div className="max-w-md">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search programs, agencies, or neighborhoods"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ChoiceChip label="All" selected={category === ""} onSelect={() => setCategory("")} />
        {categories.map((c) => (
          <ChoiceChip key={c} label={c} selected={category === c} onSelect={() => setCategory(c)} />
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Spinner size={24} />
        </div>
      ) : programs.length === 0 ? (
        <div className="rounded-card border border-border bg-surface shadow-card">
          <EmptyState icon="globe" title="No programs match" subtext="Try a broader search or a different category." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => {
            const address = [p.address, p.city, p.zip].filter(Boolean).join(", ");
            // OMH stores "Not Available" / "N/A" for missing phones — treat any
            // value without a real 7+ digit number as absent.
            const phone = p.phone && (p.phone.replace(/\D/g, "").length >= 7 ? p.phone : null);
            return (
              <Card key={p.id}>
                <div className="flex h-full flex-col gap-2">
                  <h3 className="font-semibold text-text">{p.programName}</h3>
                  {p.agency && <p className="text-sm text-text-muted">{p.agency}</p>}
                  {p.programType && (
                    <span className="inline-flex w-fit rounded-full bg-teal-100 px-2 py-0.5 text-[13px] font-medium text-primary">
                      {p.programType}
                    </span>
                  )}
                  <div className="mt-auto flex flex-col gap-1.5 pt-2 text-sm text-text-body">
                    {address && (
                      <span className="flex items-start gap-2">
                        <Icon name="globe" size={15} className="mt-0.5 shrink-0 text-text-muted" />
                        {address}
                      </span>
                    )}
                    {phone && (
                      <span className="flex items-center gap-2">
                        <Icon name="phone" size={15} className="shrink-0 text-text-muted" />
                        <TextLink href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</TextLink>
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

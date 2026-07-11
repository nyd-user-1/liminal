"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/tag";
import { TextLink } from "@/components/ui/text-link";
import { Toolbar } from "@/components/ui/toolbar";
import type { DirectoryProgram } from "@/lib/types";

// Portal Resources — the NYC mental-health directory, laid out like the
// provider Library: category tabs over a persistent search toolbar and a
// uniform card grid. Categories are long, so (Library-style) a handful are
// primary tabs and the rest tuck behind a "View More" overflow. Cards stay
// non-clickable — the phone number is the only interactive element.

// First few categories become primary tabs; the rest go to the overflow menu.
const PRIMARY_COUNT = 4;

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

  // Re-query when the category tab changes; debounce free-text search.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const primaryItems = [
    { key: "all", label: "All" },
    ...categories.slice(0, PRIMARY_COUNT).map((c) => ({ key: c, label: c })),
  ];
  const overflowItems = categories.slice(PRIMARY_COUNT).map((c) => ({ key: c, label: c }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        className="mb-4 shrink-0"
        active={category === "" ? "all" : category}
        onChange={(k) => setCategory(k === "all" ? "" : k)}
        items={primaryItems}
        overflow={overflowItems}
        overflowLabel="View More"
      />

      <Toolbar className="mb-4 shrink-0 flex-wrap">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search programs, agencies, or neighborhoods"
          className="max-w-md flex-1"
        />
      </Toolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-text-muted">
            <Spinner size={24} />
          </div>
        ) : programs.length === 0 ? (
          <div className="rounded-card border border-border bg-surface shadow-card">
            <EmptyState icon="globe" title="No programs match" subtext="Try a broader search or a different category." />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                      <Tag hue="teal" className="w-fit">
                        {p.programType}
                      </Tag>
                    )}
                    <div className="mt-auto flex flex-col gap-1.5 pt-2 text-sm text-text-body">
                      {address && (
                        <span className="flex items-start gap-2">
                          <Icon name="map-pin" size={15} className="mt-0.5 shrink-0 text-text-muted" />
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
    </div>
  );
}

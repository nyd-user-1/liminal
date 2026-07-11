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

// Portal Resources — the NYC mental-health directory (OMH data). The raw OMH
// program types are many and unwieldy, so we collapse them into four plain
// buckets — Housing / Social Services / Rehab / Outpatient — each backed by the
// highest-volume categories that fall under it. Anything outside the buckets
// still shows under "All", and every card carries its own category Tag so
// nothing is lost. Cards stay non-clickable — the phone is the only action.

type BucketKey = "housing" | "social" | "rehab" | "outpatient";

// Highest-volume OMH categories mapped into each bucket. A bucket tab fetches
// these categories and merges them; categories outside every bucket live on All.
const BUCKETS: Array<{ key: BucketKey; label: string; cats: string[] }> = [
  {
    key: "housing",
    label: "Housing",
    cats: [
      "Supportive Housing",
      "Supportive Single Room Occupancy (SP-SRO)",
      "Congregate/Treatment",
      "Apartment/Treatment",
      "SRO Community Residence",
      "Children & Youth Community Residence",
    ],
  },
  {
    key: "social",
    label: "Social Services",
    cats: [
      "Specialty Mental Health Care Management",
      "Advocacy/Support Services",
      "Assertive Community Treatment (ACT)",
      "Health Home Care Management",
      "Intensive Mobile Treatment for AOT",
      "Non-Medicaid Care Coordination",
    ],
  },
  {
    key: "rehab",
    label: "Rehab",
    cats: [
      "Comprehensive PROS with Clinical Treatment",
      "CFTSS: Psychosocial Rehabilitation (PSR)",
      "CORE Psychosocial Rehabilitation (PSR)",
      "Partial Hospitalization",
      "Day Treatment",
      "Psychosocial Club",
    ],
  },
  {
    key: "outpatient",
    label: "Outpatient",
    cats: [
      "Mental Health Outpatient Treatment and Rehabilitative Services (MHOTRS)",
      "Certified Community Behavioral Health Clinic (CCBHC)",
      "School Mental Health Program",
      "CPEP Crisis Intervention",
    ],
  },
];

// Trailing "(MHOTRS)" / "(SP-SRO)" / "(ACT)" → the abbreviation; else the raw
// category. Keeps the per-card category Tag compact.
function shortCategory(cat: string | null): string | null {
  if (!cat) return null;
  const m = cat.match(/\(([^)]+)\)\s*$/);
  return m ? m[1] : cat;
}

export function ResourcesList({
  initial,
}: {
  initial: DirectoryProgram[];
  // Kept for the page's call signature; buckets are curated, not raw categories.
  categories: string[];
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<"all" | BucketKey>("all");
  const [programs, setPrograms] = useState<DirectoryProgram[]>(initial);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // "All" fetches broadly (one call, no category); a bucket fetches each of
    // its categories in parallel and merges + dedupes by id.
    const bucket = BUCKETS.find((b) => b.key === active);
    const cats: Array<string | null> = bucket ? bucket.cats : [null];
    try {
      const results = await Promise.all(
        cats.map(async (c) => {
          const params = new URLSearchParams();
          if (q.trim()) params.set("q", q.trim());
          if (c) params.set("category", c);
          const res = await fetch(`/api/directory/portal-programs?${params.toString()}`);
          return ((await res.json()).programs ?? []) as DirectoryProgram[];
        }),
      );
      const seen = new Set<string>();
      const merged: DirectoryProgram[] = [];
      for (const arr of results) {
        for (const p of arr) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            merged.push(p);
          }
        }
      }
      merged.sort((a, b) => a.programName.localeCompare(b.programName));
      setPrograms(merged);
    } finally {
      setLoading(false);
    }
  }, [q, active]);

  // Re-query when the bucket changes; debounce free-text search.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        className="mb-4 shrink-0"
        active={active}
        onChange={(k) => setActive(k as "all" | BucketKey)}
        items={[{ key: "all", label: "All" }, ...BUCKETS.map((b) => ({ key: b.key, label: b.label }))]}
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
              const cat = shortCategory(p.programType);
              return (
                <Card key={p.id}>
                  <div className="flex h-full flex-col gap-2">
                    <h3 className="font-semibold text-text">{p.programName}</h3>
                    {p.agency && <p className="text-sm text-text-muted">{p.agency}</p>}
                    {cat && (
                      <Tag hue="teal" className="w-fit">
                        {cat}
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

"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Pagination } from "@/components/ui/pagination";

// Thin client controls for the program family pages: a county Select + audience
// ChoiceChips, and a Pagination pair — each just rewrites the URL search params
// and lets the server component re-fetch. No client-side data fetching; the list
// itself renders on the server. Composes existing kit primitives (Select,
// ChoiceChip, Pagination) — not a new primitive.

const AUDIENCES: Array<{ value: string; label: string }> = [
  { value: "", label: "Everyone" },
  { value: "children", label: "Children" },
  { value: "adolescents", label: "Teens" },
  { value: "adults", label: "Adults" },
];

function href(basePath: string, params: { county: string; audience: string; page: number }): string {
  const sp = new URLSearchParams();
  if (params.county) sp.set("county", params.county);
  if (params.audience) sp.set("audience", params.audience);
  if (params.page > 1) sp.set("page", String(params.page));
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export function ProgramFilters({
  basePath,
  counties,
  county,
  audience,
}: {
  basePath: string;
  counties: string[];
  county: string;
  audience: string;
}) {
  const router = useRouter();
  const go = (next: { county?: string; audience?: string }) =>
    router.push(href(basePath, { county, audience, ...next, page: 1 }), { scroll: false });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full sm:max-w-xs">
        <Select
          label="County"
          searchable
          value={county}
          placeholder="All counties"
          onValueChange={(v) => go({ county: v })}
          options={[{ value: "", label: "All counties" }, ...counties.map((c) => ({ value: c, label: c }))]}
        />
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-text-body">Who it&apos;s for</p>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <ChoiceChip
              key={a.value}
              label={a.label}
              selected={audience === a.value}
              onSelect={() => go({ audience: a.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProgramPagination({
  basePath,
  county,
  audience,
  page,
  pageCount,
}: {
  basePath: string;
  county: string;
  audience: string;
  page: number;
  pageCount: number;
}) {
  const router = useRouter();
  if (pageCount <= 1) return null;
  return (
    <Pagination
      page={page}
      pageCount={pageCount}
      onPageChange={(p) => router.push(href(basePath, { county, audience, page: p }), { scroll: false })}
    />
  );
}

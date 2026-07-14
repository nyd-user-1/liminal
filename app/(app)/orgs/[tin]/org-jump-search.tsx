"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/search-input";
import type { OrgListRow } from "@/lib/repos/orgs";

// Jump-to-organization search above the rail — mirrors ProviderJumpSearch in
// the directory drill-down. Types ahead against /api/orgs; selecting a hit
// navigates to that org's workspace.

export function OrgJumpSearch({ currentTin }: { currentTin: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<OrgListRow[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const s = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/orgs?q=${encodeURIComponent(term)}&limit=8`);
        const data = await res.json();
        if (s === seq.current) {
          setHits(((data.orgs ?? []) as OrgListRow[]).filter((o) => o.tin !== currentTin).slice(0, 8));
        }
      } catch {
        /* type-ahead only — stay quiet */
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, currentTin]);

  function pick(o: OrgListRow) {
    setQ("");
    setHits([]);
    router.push(`/orgs/${encodeURIComponent(o.tin)}`);
  }

  return (
    <div className="relative">
      <SearchInput
        aria-label="Search organizations"
        placeholder="Search organizations…"
        className="w-full"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQ("");
            setHits([]);
          }
        }}
      />
      {hits.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-card border border-border bg-surface shadow-menu">
          {hits.map((o) => (
            <button
              key={o.tin}
              type="button"
              className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-canvas"
              onClick={() => pick(o)}
            >
              <span className="min-w-0 truncate font-medium text-text">{o.label}</span>
              <span className="ml-auto shrink-0 tabular-nums text-xs text-text-muted">{o.npis.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

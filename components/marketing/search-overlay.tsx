"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import type { PublicResult } from "@/app/api/directory/public-search/route";

// ⌘K-style provider search overlay for the marketing nav. Hits the public
// (anon) search route; selecting a result deep-links into /providers.

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/directory/public-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  function go() {
    onClose();
    router.push(`/providers?q=${encodeURIComponent(q)}`);
  }

  return (
    <Modal open={open} onClose={onClose} title="Search providers by name" icon="search" width="max-w-xl">
      <div className="flex flex-col gap-4">
        <SearchInput
          autoFocus
          className="[&_input]:h-12 [&_input]:text-base"
          placeholder="Search therapists and psychiatrists"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && q.trim() && go()}
        />
        <div className="min-h-[8rem]">
          {loading && <p className="px-1 py-4 text-sm text-text-muted">Searching…</p>}
          {!loading && q.trim() && results.length === 0 && (
            <p className="px-1 py-4 text-sm text-text-muted">No matches. Try a broader term.</p>
          )}
          <ul className="flex flex-col divide-y divide-border">
            {results.slice(0, 10).map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <button
                  type="button"
                  onClick={go}
                  className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-canvas"
                >
                  <Icon name={r.kind === "provider" ? "person-circle" : "globe"} size={18} className="text-text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-text">{r.name}</span>
                    <span className="block truncate text-sm text-text-muted">
                      {[r.subtitle, r.county].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {results.length > 0 && (
            <button
              type="button"
              onClick={go}
              className="mt-2 w-full rounded-field px-1 py-2 text-left text-sm font-semibold text-primary hover:text-primary-hover"
            >
              See all results for “{q}” →
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

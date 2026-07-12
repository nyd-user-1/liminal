"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { Spinner } from "@/components/ui/spinner";
import { ProviderPanel, type ProviderPanelData } from "@/components/providers/provider-panel";
import type { PublicResult } from "@/app/api/directory/public-search/route";
import { titleCase } from "@/lib/format";

// Everything after this provider: the rest of the New York directory, a→z, in
// the same folded panel the profile above uses. The public-search route already
// orders by name when there's no query, so page N is simply the next slice of
// the alphabet; `bookableFirst=0` keeps Leuk's own practitioners from being
// hoisted to the top of it and breaking that order.
//
// Pages append as the sentinel nears the viewport. The provider whose page this
// is gets filtered out of whichever slice contains them.

const PAGE_SIZE = 10;

function toPanel(r: PublicResult): ProviderPanelData {
  const specialties = [r.subspecialty, r.subtitle].filter((v): v is string => Boolean(v));
  return {
    id: r.id,
    name: r.name,
    profession: r.subtitle,
    credential: r.credential ?? null,
    specialties: [...new Set(specialties)],
    locationLabel:
      [r.address ? titleCase(r.address) : null, r.city ? titleCase(r.city) : null, r.zip].filter(Boolean).join(", ") ||
      null,
    gender: r.gender ?? null,
  };
}

export function ProviderDirectoryRail({ excludeId }: { excludeId: string }) {
  const [providers, setProviders] = useState<PublicResult[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadPage = useCallback(async (next: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({
        kind: "providers",
        bookableFirst: "0",
        page: String(next),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/directory/public-search?${params}`);
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setProviders((prev) => [...prev, ...(data.results ?? [])]);
      setHasMore(Boolean(data.hasMore));
      setPage(next);
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || error) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadPage(page + 1);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, error, page, loadPage]);

  const shown = providers.filter((r) => r.id !== excludeId);

  return (
    <section className="space-y-6">
      {shown.length > 0 && (
        <h2 className="pt-2 font-display text-2xl font-bold tracking-tight text-text">More providers</h2>
      )}

      {shown.map((r) => (
        <ProviderPanel
          key={r.id}
          provider={toPanel(r)}
          href={r.slug ? `/providers/${r.slug}` : undefined}
        />
      ))}

      <div ref={sentinelRef} aria-hidden className="h-px" />

      {loading && (
        <div className="flex items-center justify-center py-8 text-text-muted">
          <Spinner size={20} />
        </div>
      )}

      {error && (
        <Banner variant="danger" action={<Button size="sm" onClick={() => loadPage(page + 1)}>Try again</Button>}>
          Something went wrong loading more providers.
        </Banner>
      )}

      {!hasMore && !loading && shown.length > 0 && (
        <p className="py-8 text-center text-sm text-text-muted">That&apos;s the end of the directory.</p>
      )}
    </section>
  );
}

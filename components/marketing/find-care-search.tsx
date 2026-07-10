"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import {
  CareSearchGroup,
  EMPTY_FILTERS,
  type CareFacets,
  type CareFilters,
} from "@/components/marketing/care-search-group";
import { FindCareSpotlightCard } from "@/components/marketing/provider-spotlight-card";
import type { PublicResult } from "@/app/api/directory/public-search/route";

// /providers — providers only. Programs live at /programs and were never what
// this page was for; showing them here meant a "0 providers found" header
// sitting above a stack of program cards.
//
// The full directory is the default state: page 1 loads on mount with no query
// (previously the page sat on a "search 8,500+ providers" placeholder until you
// typed), and further pages append on scroll rather than paginate. Any filter
// change discards the list and re-fetches from page 1.
//
// The search group is sticky 30px below the nav; results scroll behind it.

const PAGE_SIZE = 20;
// Pins flush to the bottom of the nav, then insets the card 30px with
// padding — the wrapper's `bg-page` then fills that gap, so result cards
// pass cleanly behind the group instead of being sliced against the nav's
// bottom edge. The nav's own height oscillates 70–100px on scroll direction
// (see Nav's `compact` state), so the pin offset is measured live off the
// nav's actual DOM height (`navHeight` below) rather than hardcoded — a
// fixed value would leave the group overlapped or gapped whenever the nav
// re-expands while this group is already stuck.
//
// STICKY_GATE_PX is a separate, looser number: just an approximation of the
// nav height for "has the group actually started sticking yet" below. The
// hero above it is 300px+, so a 30px margin of error there (70 vs 100)
// never moves that gate noticeably.
const STICKY_GATE_PX = 70;

export function FindCareSearch({
  initialQ = "",
  initialCity = "",
  initialSpecialty = "",
  facets,
}: {
  initialQ?: string;
  initialCity?: string;
  initialSpecialty?: string;
  facets: CareFacets;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<CareFilters>({
    ...EMPTY_FILTERS,
    q: initialQ,
    city: initialCity,
    specialty: initialSpecialty,
  });

  const [results, setResults] = useState<PublicResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  // The committed query — only a Search press (or Enter) promotes `filters.q`
  // to this, so typing doesn't refetch on every keystroke. Dropdowns commit
  // immediately, which is why they're not part of it.
  const [committedQ, setCommittedQ] = useState(initialQ);

  const sentinelRef = useRef<HTMLDivElement>(null);
  // Monotonic request token: a filter change while a "load more" is still in
  // flight must win, and the older response must not append to the new list.
  const reqIdRef = useRef(0);

  // Collapses the filter row once the search group is actually pinned:
  // scrolling down hides filters (search input stays put), scrolling up
  // brings them back. Below the pin point it's always expanded — collapsing
  // ordinary in-flow content would just look like the page randomly shrank.
  const groupRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  // Matches Nav's expanded height by default (100px) so there's no first-paint
  // gap before the first measurement runs.
  const [navHeight, setNavHeight] = useState(100);

  useEffect(() => {
    const navEl = document.querySelector<HTMLElement>("[data-nav]");
    const stickyStart = { current: 0 };
    const measure = () => {
      const el = groupRef.current;
      if (!el) return;
      stickyStart.current = el.getBoundingClientRect().top + window.scrollY - STICKY_GATE_PX;
      if (navEl) setNavHeight(navEl.getBoundingClientRect().height);
    };
    measure();

    let lastY = window.scrollY;
    // Cumulative travel since the last direction reversal, not frame-to-frame
    // velocity — see the matching comment in Nav's scroll effect. Momentum
    // scrolling's noisy tail can flip a per-frame threshold back and forth
    // right as the user stops, which visibly yanks the collapsed filters
    // open/closed. 32px of sustained travel filters that out.
    let dir = 0;
    let accum = 0;
    const TOGGLE_PX = 32;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const diff = y - lastY;
        lastY = y;
        if (y <= stickyStart.current) {
          setCollapsed(false);
          dir = 0;
          accum = 0;
        } else if (diff !== 0) {
          const newDir = diff > 0 ? 1 : -1;
          if (newDir !== dir) {
            dir = newDir;
            accum = 0;
          }
          accum += Math.abs(diff);
          if (accum > TOGGLE_PX) setCollapsed(dir === 1);
        }
        // Nav's height animates on the same scroll-direction logic — keep
        // this group's pin offset tracking it live (see the comment above
        // STICKY_GATE_PX).
        if (navEl) setNavHeight(navEl.getBoundingClientRect().height);
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const fetchPage = useCallback(
    async (targetPage: number, f: CareFilters, q: string) => {
      const reqId = ++reqIdRef.current;
      if (targetPage === 1) setLoading(true);
      else setLoadingMore(true);
      setError(false);

      const params = new URLSearchParams({ kind: "providers", page: String(targetPage), pageSize: String(PAGE_SIZE) });
      if (q.trim()) params.set("q", q.trim());
      if (f.city) params.set("city", f.city);
      if (f.specialty) params.set("specialty", f.specialty);
      if (f.type) params.set("type", f.type);
      if (f.insurance) params.set("insurance", f.insurance);

      try {
        const res = await fetch(`/api/directory/public-search?${params.toString()}`);
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        if (reqId !== reqIdRef.current) return; // superseded — drop it
        const incoming: PublicResult[] = data.results ?? [];
        setResults((prev) => (targetPage === 1 ? incoming : [...prev, ...incoming]));
        setTotal(data.total ?? 0);
        setHasMore(Boolean(data.hasMore));
        setPage(targetPage);
      } catch {
        if (reqId === reqIdRef.current) setError(true);
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  // Page 1 on mount (the whole directory when no query/filter came in on the
  // URL), and again whenever a dropdown or a committed query changes.
  useEffect(() => {
    fetchPage(1, filters, committedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.city, filters.specialty, filters.type, filters.insurance, committedQ]);

  // Infinite scroll: append the next page as the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || loadingMore || error) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchPage(page + 1, filters, committedQ);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, error, page, filters, committedQ, fetchPage]);

  return (
    <div className="mt-6">
      {/* `mt-6` above only sets the group's resting place under the hero — once
          it pins, `top` wins and the margin stops mattering. */}
      <div ref={groupRef} className="sticky z-30 bg-page pb-4 pt-[30px]" style={{ top: navHeight }}>
        <CareSearchGroup
          facets={facets}
          filters={filters}
          onChange={setFilters}
          onSubmit={() => {
            if (filters.q === committedQ) fetchPage(1, filters, filters.q);
            else setCommittedQ(filters.q);
          }}
          collapsed={collapsed}
        />
      </div>

      <div className="mt-4">
        {loading && (
          <div className="flex items-center justify-center py-16 text-text-muted">
            <Spinner size={24} />
          </div>
        )}

        {!loading && error && (
          <Banner
            variant="danger"
            action={
              <Button size="sm" onClick={() => fetchPage(1, filters, committedQ)}>
                Try again
              </Button>
            }
          >
            Something went wrong loading results.
          </Banner>
        )}

        {!loading && !error && results.length === 0 && (
          <EmptyState icon="search" title="No matches" subtext="Try a different name, specialty, or clear a filter." />
        )}

        {!loading && !error && results.length > 0 && (
          <>
            <p className="mb-4 text-sm text-text-muted">
              {total.toLocaleString()} {total === 1 ? "provider" : "providers"} found
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {results.map((r) => (
                <FindCareSpotlightCard key={`${r.kind}-${r.id}`} r={r} />
              ))}
            </div>

            <div ref={sentinelRef} aria-hidden className="h-px" />

            {loadingMore && (
              <div className="flex items-center justify-center py-8 text-text-muted">
                <Spinner size={20} />
              </div>
            )}

            {/* Nobody in this search is bookable on Liminal — offer the direct
                route once the list has run out, not partway down it. */}
            {!hasMore && !loadingMore && !results.some((r) => r.bookable) && (
              <Card className="mt-4 border-primary/30 bg-teal-100/40">
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

            {!hasMore && !loadingMore && (
              <p className="py-8 text-center text-sm text-text-muted">
                That&apos;s everyone matching this search.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

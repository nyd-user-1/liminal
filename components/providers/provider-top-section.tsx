"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

// The top of the provider page: a search group that stays pinned under the nav
// for the whole scroll, the provider's own panel beneath it, and the booking
// widget beside both — sharing their top edge and their bottom edge, whichever
// side is taller (a live calendar out-measures a sparse NPI panel; a rich panel
// out-measures the directory rail's short hand-off card).
//
// Why this is measured rather than a `grid` + `items-stretch`: the search group
// is `position: sticky` for the length of the page, and a sticky element can
// only travel inside its own containing block. That forces the entire left
// column — panel, nearby areas, the A–Z rail below — to be one tall box. Stretch
// the booking widget against *that* and it runs to the foot of the page. So the
// row's height is computed once on mount (and on resize): the taller of
// `search + gap + panel` and the widget's own natural height, applied as a floor
// to both sides. Without JS both sides simply keep their natural heights, which
// is a perfectly readable fallback.

const GAP = 24; // gap-6, between the sticky search group and the panel
const DESKTOP = 1024; // lg: — below this the rail stacks under the column

export function ProviderTopSection({
  search,
  panel,
  rail,
  children,
}: {
  search: ReactNode;
  panel: ReactNode;
  rail: ReactNode;
  /**
   * The rest of the left column — nearby areas, then the A–Z rail. It lives
   * inside the sticky element's containing block on purpose: that's what lets
   * it scroll up and away *behind* the search group rather than shoving it off.
   */
  children?: ReactNode;
}) {
  const searchRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const sync = () => {
      const s = searchRef.current;
      const p = panelRef.current;
      const r = railRef.current;
      if (!s || !p || !r) return;

      // Always measure natural heights, never the ones we last imposed.
      p.style.minHeight = "";
      r.style.minHeight = "";
      if (window.innerWidth < DESKTOP) return;

      const target = Math.max(s.offsetHeight + GAP + p.offsetHeight, r.offsetHeight);
      p.style.minHeight = `${target - s.offsetHeight - GAP}px`;
      r.style.minHeight = `${target}px`;
    };

    sync();
    // Web fonts and the blob illustration settle a frame or two after mount.
    const raf = requestAnimationFrame(sync);
    window.addEventListener("resize", sync);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return (
    <div className="grid gap-x-8 lg:grid-cols-[1fr_320px] lg:items-start">
      {/* Column 1 is one tall box: the sticky search group's containing block,
          so everything under it — panel, nearby, A–Z — passes behind it. */}
      <div className="flex min-w-0 flex-col gap-6">
        {/* Pins flush to the 70px scrolled nav and holds the card 30px below it
            with padding, rather than sticking the card itself at 100px — that
            way the wrapper's `bg-page` fills the 30px gap and cards pass behind
            it cleanly instead of being sliced by the nav's bottom edge. */}
        <div ref={searchRef} className="sticky top-[70px] z-30 bg-page pb-4 pt-[30px]">
          {search}
        </div>
        {/* `panel` and `rail` must each be a flex column that grows into the
            height we impose here — a `h-full` child of a flex-*grown* box
            resolves its percentage against `auto`, not against the grown
            height, so the fill has to be carried down by flex, not by %. */}
        <div ref={panelRef} className="flex flex-col">
          {panel}
        </div>
        {children}
      </div>

      {/* Column 2 starts flush with the search group and ends flush with the
          panel. On mobile the grid collapses to one column and column 1 runs
          to the foot of an infinite list, so the widget is ordered first there
          rather than stranded past the last provider. */}
      {/* `pt-[30px]` mirrors the search group's, so the widget's top edge lines
          up with the search card's rather than the wrapper's. */}
      <div ref={railRef} className="order-first mb-6 flex flex-col lg:order-none lg:mb-0 lg:pt-[30px]">
        {rail}
      </div>
    </div>
  );
}

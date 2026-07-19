"use client";

import { useEffect, useRef, useState } from "react";

// Count-up number for the marketing stat bands — animates 0 → value the first
// time it scrolls into view, then holds. NEW (public marketing site): a small
// client span that slots into the existing StatBand as its `value`, so the
// static primitive is untouched and only the pages that opt in animate.
//
// Honest by construction: the final rendered string is exactly what a static
// label would show (same compact/int formatting + suffix). SSR and the no-JS /
// reduced-motion path render that final value immediately — the animation only
// enhances an already-correct default, and never gates the number's visibility.

function compact(n: number): string {
  if (n >= 1_000_000) return `${Math.floor(n / 100_000) / 10}`.replace(/\.0$/, "") + "M";
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return `${Math.floor(n)}`;
}

function fmt(n: number, format: "compact" | "int"): string {
  return format === "compact" ? compact(n) : Math.round(n).toLocaleString("en-US");
}

export function CountUp({
  to,
  format = "int",
  suffix = "",
  durationMs = 1200,
  className = "",
}: {
  to: number;
  format?: "compact" | "int";
  suffix?: string;
  durationMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = fmt(to, format) + suffix;
  const [display, setDisplay] = useState(final);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // hold final

    // Only animate when the element enters from off-screen — if it's already in
    // view on load, leave the final value (resetting to 0 would flash).
    const rect = el.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyVisible) return;

    setDisplay(fmt(0, format) + suffix);
    let raf = 0;
    let started = false;
    const run = () => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / durationMs);
        const eased = 1 - Math.pow(1 - p, 4); // easeOutQuart
        setDisplay(p < 1 ? fmt(to * eased, format) + suffix : final);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started) {
            started = true;
            io.disconnect();
            run();
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, format, suffix, durationMs, final]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}

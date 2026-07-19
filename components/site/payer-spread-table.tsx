"use client";

import { useEffect, useRef, useState } from "react";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { formatDate } from "@/lib/format";
import type { PayerMedianRow, PayerSpread } from "@/lib/repos/public-stats";

// Aggregate payer-median spread, rendered as a ranked bar list — the "why the
// same session pays so differently" moment, made of live data. NEW (public
// marketing site): a composition of InsurerMark + tokens, shared by the
// pricing-data and payer-negotiation pages (one source, two surfaces). Reuses
// the rate table's own InsurerMark so the payer marks match the app exactly.
//
// Motion (marketing-side, all with a prefers-reduced-motion fallback):
//   • the ranked list auto-scrolls gently and pauses on hover / touch;
//   • each bar fills left-to-right the first time it scrolls into view;
//   • each row carries a tooltip (payer · median · clinicians).
// Reduced motion → no auto-scroll (a plain scrollable list) and bars at full
// width immediately. The number is never gated on the animation.
//
// HONESTY (rule 4, structural): every figure is the payer's OWN published
// in-network median for one CPT across NY books — aggregate market intelligence,
// never a specific plan's rate and never what a patient pays. The column header
// and the footnote carry that qualifier; the bar width is a visual proportion,
// not a second rate.

const ROW_TIP = (r: PayerMedianRow) => `${r.payer} · ${r.median} · ${r.clinicians.toLocaleString("en-US")} clinicians`;

function SpreadRow({ r, filled }: { r: PayerMedianRow; filled: boolean }) {
  return (
    <li
      title={ROW_TIP(r)}
      className="grid grid-cols-1 gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center sm:px-7"
    >
      <div className="flex min-w-0 items-center gap-3">
        <InsurerMark payer={r.payer} />
        <span className="min-w-0">
          <span className="block truncate font-medium text-text">{r.payer}</span>
          <span className="block text-[13px] text-text-muted">{r.clinicians.toLocaleString("en-US")} clinicians</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-primary-wash">
          <div
            className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-[900ms] motion-safe:ease-out"
            style={{ width: filled ? `${r.barPct}%` : "0%" }}
          />
        </div>
        <span className="w-20 shrink-0 text-right font-display text-[17px] font-semibold tabular-nums text-text">
          {r.median}
        </span>
      </div>
    </li>
  );
}

export function PayerSpreadTable({ spread }: { spread: PayerSpread }) {
  const figRef = useRef<HTMLElement>(null);
  const [marquee, setMarquee] = useState(false); // client + motion-ok → auto-scroll
  const [filled, setFilled] = useState(false); // bars at full width once in view
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setFilled(true); // bars full width, no transition
      return;
    }
    if (spread.rows.length > 7) setMarquee(true); // enough rows to be worth scrolling
    const el = figRef.current;
    if (!el) {
      setFilled(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setFilled(true);
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [spread.rows.length]);

  if (spread.rows.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center shadow-card">
        <p className="text-[15px] text-text-body">
          The live payer median spread is loading from the rate corpus. Explore it on the rates surface.
        </p>
      </div>
    );
  }

  const asOf = spread.asOf ? formatDate(spread.asOf) : null;
  const windowH = 7 * 72; // ~7 rows of the marquee window; each row ~72px tall

  return (
    <figure ref={figRef} className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-4 sm:px-7">
        <span className="font-display text-[17px] font-semibold text-text">
          CPT {spread.code} · {spread.codeLabel}
        </span>
        <span className="text-[13px] font-medium text-text-muted">
          Payer-published in-network median{asOf ? ` · as of ${asOf}` : ""}
        </span>
      </figcaption>

      {marquee ? (
        <div
          className="relative overflow-hidden"
          style={{ maxHeight: windowH }}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
        >
          {/* Two identical stacks translate up in a seamless loop; the second is
              hidden from the accessibility tree so rows aren't announced twice. */}
          <div className="spread-marquee-track" style={{ animationPlayState: paused ? "paused" : "running" }}>
            <ol className="divide-y divide-border">
              {spread.rows.map((r) => (
                <SpreadRow key={r.payer} r={r} filled={filled} />
              ))}
            </ol>
            <ol className="divide-y divide-border border-t border-border" aria-hidden>
              {spread.rows.map((r) => (
                <SpreadRow key={`dup-${r.payer}`} r={r} filled={filled} />
              ))}
            </ol>
          </div>
          {/* soft top/bottom fades so rows enter and leave gracefully */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-surface to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface to-transparent" />
          <style>{`
            .spread-marquee-track { animation: spread-scroll 34s linear infinite; will-change: transform; }
            @keyframes spread-scroll { from { transform: translateY(0); } to { transform: translateY(-50%); } }
            @media (prefers-reduced-motion: reduce) { .spread-marquee-track { animation: none; } }
          `}</style>
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {spread.rows.map((r) => (
            <SpreadRow key={r.payer} r={r} filled={filled} />
          ))}
        </ol>
      )}

      <p className="border-t border-border bg-canvas px-5 py-4 text-[13px] leading-relaxed text-text-muted sm:px-7">
        Each figure is the payer&rsquo;s own published in-network median for CPT {spread.code}
        {" "}across New York behavioral books — aggregate market intelligence, not a specific plan&rsquo;s rate and
        never what a patient pays.
      </p>
    </figure>
  );
}

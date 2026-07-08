"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";

const CUT = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/cut";

// "Find care for whatever's on your mind" — a horizontal rail of need-cards, each
// a tinted illustration over a first-person title + a stacked (placeholder)
// provider-avatar row. Controls (Explore all + prev/next) sit top-right, aligned
// to the page content; cards full-bleed off the right edge. Placeholder art +
// avatars — swap for real need illustrations / therapist photos.
type Card = { title: string; sub: string; tint: string; illo: string };

const CARDS: Card[] = [
  { title: "Managing stress", sub: "Identifying and handling stressors within my life", tint: "bg-[#e6eff0]", illo: "grounding" },
  { title: "Challenges with family", sub: "Difficulties in my family relationships", tint: "bg-[#eaf1ea]", illo: "walking-together" },
  { title: "Career-related anxiety", sub: "Uncertainty and stress caused by my career", tint: "bg-[#f6efdd]", illo: "one-thing" },
  { title: "Feeling down or lacking motivation", sub: "Feelings of sadness, indifference, or apathy", tint: "bg-[#e6eff0]", illo: "resting-meadow" },
  { title: "Anxiety & panic", sub: "Racing thoughts, worry, and moments of panic", tint: "bg-[#eaf1ea]", illo: "lakeside" },
  { title: "Grief & loss", sub: "Carrying the weight of a loss or big change", tint: "bg-[#f6efdd]", illo: "dusk-lake" },
];

const AVATARS = ["bg-primary-wash", "bg-amber-100", "bg-teal-200", "bg-[#e5ddc9]"];

export function CareCarousel() {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);
  const nudge = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector("figure");
    const step = card ? card.getBoundingClientRect().width + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };
  const ctrl =
    "flex h-10 w-10 items-center justify-center rounded-full border border-page-edge bg-surface text-primary transition disabled:opacity-40";

  return (
    <div>
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-6">
        <h2 className="max-w-xl text-balance font-display text-4xl font-bold tracking-tight text-text sm:text-[40px] sm:leading-[1.08]">
          Find care for whatever&apos;s on your mind.
        </h2>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/find-care"
            className="hidden rounded-field border border-border bg-surface px-4 py-2 text-[15px] font-medium text-primary transition-colors hover:border-primary sm:inline-flex"
          >
            Explore all
          </Link>
          <button type="button" aria-label="Previous" onClick={() => nudge(-1)} disabled={atStart} className={ctrl}>
            <Icon name="chevron-left" size={18} />
          </button>
          <button type="button" aria-label="Next" onClick={() => nudge(1)} disabled={atEnd} className={ctrl}>
            <Icon name="chevron-right" size={18} />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="no-scrollbar mt-8 flex gap-6 overflow-x-auto scroll-smooth pb-2 pl-[max(24px,calc(50vw_-_552px))] pr-[max(24px,calc(50vw_-_552px))]"
      >
        {CARDS.map((c) => (
          <Link
            href="/find-care"
            key={c.title}
            className="group flex w-[280px] shrink-0 flex-col overflow-hidden rounded-card border border-page-edge bg-surface transition-shadow hover:shadow-card sm:w-[300px]"
          >
            <div className={`flex h-40 items-center justify-center overflow-hidden ${c.tint}`}>
              <img src={`${CUT}/${c.illo}.avif`} alt="" className="h-32 w-auto object-contain" loading="lazy" />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h3 className="font-display text-lg font-semibold text-text transition-colors group-hover:text-primary">
                {c.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-text-body">{c.sub}</p>
              <div className="mt-5 flex items-center" aria-hidden>
                {AVATARS.map((a, i) => (
                  <span key={i} className={`-ml-2 h-8 w-8 rounded-full ring-2 ring-surface first:ml-0 ${a}`} />
                ))}
                <span className="ml-2 text-sm text-text-muted">…</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

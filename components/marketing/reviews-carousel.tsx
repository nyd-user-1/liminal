export type Review = { name: string; title: string; text: string };

// Horizontal review rail — scrolls via trackpad / wheel / touch with the scrollbar
// hidden. Full-bleeds off one screen edge while the first card stays aligned to the
// page content (the pl/pr math mirrors the max-w-6xl container gutter). `bleed`
// picks the edge: "right" (default) or "left" (RTL scroller, for inverted sections).
export function ReviewsCarousel({ reviews, bleed = "right" }: { reviews: Review[]; bleed?: "left" | "right" }) {
  return (
    <div
      dir={bleed === "left" ? "rtl" : undefined}
      className="no-scrollbar flex gap-6 overflow-x-auto scroll-smooth pb-2 pl-[max(24px,calc(50vw_-_552px))] pr-[max(24px,calc(50vw_-_552px))]"
    >
      {reviews.map((r) => (
        <figure
          key={r.name}
          dir="ltr"
          className="flex w-[290px] shrink-0 flex-col rounded-card border border-page-edge bg-surface p-6 sm:w-[340px]"
        >
          <h3 className="font-display text-lg font-bold tracking-tight text-primary">{r.title}</h3>
          <blockquote className="mt-3 line-clamp-4 flex-1 text-pretty leading-relaxed text-text-body">{r.text}</blockquote>
          <figcaption className="mt-5 text-[15px] font-medium text-text">{r.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

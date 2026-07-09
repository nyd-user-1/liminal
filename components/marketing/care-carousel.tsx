import Link from "next/link";
import { Icon } from "@/components/ui/icons";

const ILLUSTRATIONS = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations";
const illustration = (name: string) => `${ILLUSTRATIONS}/${name}.avif`;
const gridPhoto = (name: string) => `${ILLUSTRATIONS}/Hompage%20Grid/${encodeURIComponent(name)}.avif`;

// "Find care for whatever's on your mind" — a static 3-col x 4-row grid of
// portrait cards (same chrome as ProviderSpotlightCard — border/hover — just
// image-on-top instead of image-left). Per Brendan's second pass:
//   - every card is the same shape: fixed-height image (object-cover, so
//     source aspect ratio never changes the card height) + a fixed-height
//     title row — no description, so nothing can make one card taller
//     than its neighbors.
//   - title is teal by default (not just on hover); the up-right arrow
//     rotates flat to point right on hover, signaling motion forward.
//   - images: Brendan's new "Hompage Grid" blob folder first (7 of its 10
//     files show an identifiable person — objects1/objects2/image.jpg are
//     still-life shots, excluded), topped up with as few of the older
//     "maya" portraits as needed (5 of 6) to fill all 12 slots — the point
//     being even distribution, no single recurring character dominating.
// Links: a real /care/[slug] page where lib/site-content/topics.ts has one
// (the 9 conditions in the nav's Conditions panel); otherwise a slug with no
// topic entry, which /care/[topic] 404s on by design.
type Card = { slug: string; label: string; image: string };

const CARDS: Card[] = [
  { slug: "anxiety", label: "Anxiety & stress", image: gridPhoto("sam2") },
  { slug: "depression", label: "Depression & mood", image: gridPhoto("nia2") },
  { slug: "adhd", label: "ADHD", image: gridPhoto("image (8)") },
  { slug: "trauma", label: "Trauma & PTSD", image: gridPhoto("image (9)") },
  { slug: "relationships", label: "Relationships & family", image: gridPhoto("image (10)") },
  { slug: "grief", label: "Grief & loss", image: gridPhoto("image (11)") },
  { slug: "sleep", label: "Sleep", image: gridPhoto("marco1") },
  { slug: "bipolar", label: "Bipolar disorder", image: illustration("maya-1") },
  { slug: "lgbtqia", label: "LGBTQIA+ affirming", image: illustration("maya-2") },
  { slug: "autism", label: "Autism (ASD)", image: illustration("maya6") },
  { slug: "ocd", label: "OCD", image: illustration("maya10") },
  { slug: "mania", label: "Mania", image: illustration("maya11") },
];

export function CareCarousel() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="max-w-xl text-balance font-display text-4xl font-bold tracking-tight text-text sm:text-[40px] sm:leading-[1.08]">
          Find care for whatever&apos;s on your mind.
        </h2>
        <Link
          href="/find-care"
          className="hidden shrink-0 rounded-field border border-border bg-surface px-4 py-2 text-[15px] font-medium text-primary transition-colors hover:border-primary sm:inline-flex"
        >
          Explore all
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.slug}
            href={`/care/${c.slug}`}
            className="group flex flex-col overflow-hidden rounded-card border border-page-edge bg-surface transition-colors hover:border-primary"
          >
            <div className="h-64 w-full shrink-0 overflow-hidden">
              <img src={c.image} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="flex min-h-[4.5rem] items-center justify-between gap-3 p-5">
              <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug text-primary">{c.label}</h3>
              <Icon
                name="arrow-right"
                size={20}
                className="-rotate-45 shrink-0 text-primary transition-transform duration-200 group-hover:rotate-0"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

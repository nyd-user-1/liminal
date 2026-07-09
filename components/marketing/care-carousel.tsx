import Link from "next/link";
import { Icon } from "@/components/ui/icons";

const ILLUSTRATIONS = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations";
const illustration = (name: string) => `${ILLUSTRATIONS}/${name}.avif`;

// "Find care for whatever's on your mind" — a static 3-col x 4-row grid of
// portrait cards (same chrome as ProviderSpotlightCard — border/hover — just
// image-on-top instead of image-left). Per Brendan's second pass:
//   - every card is the same shape: fixed-height image (object-cover, so
//     source aspect ratio never changes the card height) + a fixed-height
//     title row — no description, so nothing can make one card taller
//     than its neighbors.
//   - title is teal by default (not just on hover); the up-right arrow
//     rotates flat to point right on hover, signaling motion forward.
//   - images are exclusively the curated "person in a scene" illustrations
//     (single identifiable figure, not a group, not a bare landscape or a
//     landscape with only a silhouette) — condition-named art (ADHD.avif
//     etc.) and mood art (Hope/Calm/…) are deliberately not used here.
// Links: a real /care/[slug] page where lib/site-content/topics.ts has one
// (the 9 conditions in the nav's Conditions panel); otherwise a slug with no
// topic entry, which /care/[topic] 404s on by design.
type Card = { slug: string; label: string; image: string };

const CARDS: Card[] = [
  { slug: "anxiety", label: "Anxiety & stress", image: illustration("maya-1") },
  { slug: "depression", label: "Depression & mood", image: illustration("maya6") },
  { slug: "adhd", label: "ADHD", image: illustration("liminal-9") },
  { slug: "trauma", label: "Trauma & PTSD", image: illustration("liminal_nielb8nielb8niel") },
  { slug: "relationships", label: "Relationships & family", image: illustration("maya-2") },
  { slug: "grief", label: "Grief & loss", image: illustration("liminal_a2t92la2t92la2t9") },
  { slug: "sleep", label: "Sleep", image: illustration("liminal_e0mhvxe0mhvxe0mh") },
  { slug: "bipolar", label: "Bipolar disorder", image: illustration("liminal_n1y3w0n1y3w0n1y3") },
  { slug: "lgbtqia", label: "LGBTQIA+ affirming", image: illustration("liminal_4ji9244ji9244ji9") },
  { slug: "autism", label: "Autism (ASD)", image: illustration("liminal_5ziunj5ziunj5ziu") },
  { slug: "ocd", label: "OCD", image: illustration("liminal_7h6ra17h6ra17h6r") },
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

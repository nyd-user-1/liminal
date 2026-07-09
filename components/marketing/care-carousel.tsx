import Link from "next/link";
import { getTopic } from "@/lib/site-content";

const BLOB = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com";
const illustrations = (name: string) => `${BLOB}/illustrations/${name}.avif`;
const condition = (name: string) => `${BLOB}/${name}.avif`;

// "Find care for whatever's on your mind" — reworked from a horizontal rail
// into a static 4-col x 3-row grid of portrait cards (same chrome as
// ProviderSpotlightCard — border/hover/typography — just image-on-top
// instead of image-left). Per Brendan:
//   - image: the matching blob condition photo (ADHD/Anxiety/Depressed/
//     Bi-Polar/ASD/OCD/Mania) where the name 1:1 matches; otherwise one of
//     the curated "maya" portraits.
//   - link: a real /care/[slug] page where lib/site-content/topics.ts has
//     one (the same 9 conditions in the nav's Conditions panel); otherwise a
//     slug with no topic entry, which /care/[topic] 404s on by design.
// Title/sub for the 9 real topics come straight from topics.ts (getTopic) so
// this card's copy never drifts from the page it links to.
type Card = { slug: string; label: string; sub: string; image: string };

function topicCard(slug: string, image: string): Card {
  const topic = getTopic(slug);
  return { slug, label: topic?.label ?? slug, sub: topic?.firstPerson ?? "", image };
}

const CARDS: Card[] = [
  topicCard("anxiety", condition("Anxiety")),
  topicCard("depression", condition("Depressed")),
  topicCard("adhd", condition("ADHD")),
  topicCard("trauma", illustrations("maya-1")),
  topicCard("relationships", illustrations("maya-2")),
  topicCard("grief", illustrations("maya-4")),
  topicCard("sleep", illustrations("maya6")),
  topicCard("bipolar", condition("Bi-Polar")),
  topicCard("lgbtqia", illustrations("maya10")),
  { slug: "autism", label: "Autism (ASD)", sub: "My brain works differently, and I want support that gets that.", image: condition("ASD") },
  { slug: "ocd", label: "OCD", sub: "The intrusive thoughts and rituals won't let up.", image: condition("OCD") },
  { slug: "mania", label: "Mania", sub: "My highs feel as unmanageable as my lows.", image: condition("Mania") },
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

      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {CARDS.map((c) => (
          <Link
            key={c.slug}
            href={`/care/${c.slug}`}
            className="group flex flex-col overflow-hidden rounded-card border border-page-edge bg-surface transition-shadow hover:shadow-card"
          >
            <div className="aspect-[3/4] w-full overflow-hidden">
              <img src={c.image} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-display text-lg font-semibold text-text transition-colors group-hover:text-primary">
                {c.label}
              </h3>
              {c.sub && <p className="mt-2 text-sm leading-relaxed text-text-body">{c.sub}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

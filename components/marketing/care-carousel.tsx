import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { WatercolorHover } from "@/components/marketing/watercolor-hover";

const ILLUSTRATIONS = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations";
const illustration = (name: string) => `${ILLUSTRATIONS}/${name}.avif`;
const gridPhoto = (name: string) => `${ILLUSTRATIONS}/Hompage%20Grid/${encodeURIComponent(name)}.avif`;

// "Care for life." — a static 3-col x 4-row grid of
// portrait cards. Per Brendan's third pass: the photo is now the whole card
// (aspect-[4/5], object-cover, no separate footer) with the same
// WatercolorHover cursor-bloom used on every other illustration on the site;
// the title + arrow live in a scrim overlay that's invisible until hover,
// rather than a permanent white label strip.
//   - images: Brendan's "Hompage Grid" blob folder first (7 of its 10 files
//     show an identifiable person — objects1/objects2/image.jpg are
//     still-life shots, excluded), topped up with as few of the older
//     "maya" portraits as needed (5 of 6) — even distribution, no single
//     recurring character dominating.
//   - objectPosition: object-cover's default (center) crops sam2 oddly
//     since the source is a wide landscape scene with the subject sitting
//     left-of-center — nudged left so he isn't cropped out on tall cards.
// Links: a real /care/[slug] page where lib/site-content/topics.ts has one
// (the 9 conditions in the nav's Conditions panel); otherwise a slug with no
// topic entry, which /care/[topic] 404s on by design.
// `darkImage` — an optional alternate illustration swapped in via the
// marketing dark toggle (CSS-only, see .care-img-dark in globals.css); most
// cards don't have one and just render `image` in both themes.
type Card = { slug: string; label: string; image: string; darkImage?: string; objectPosition?: string };

const CARDS: Card[] = [
  { slug: "anxiety", label: "Anxiety", image: gridPhoto("sam2"), objectPosition: "30% 50%" },
  { slug: "depression", label: "Depression", image: gridPhoto("nia2") },
  { slug: "adhd", label: "ADHD", image: gridPhoto("image (8)") },
  {
    slug: "trauma",
    label: "Trauma",
    image: gridPhoto("image (9)"),
    darkImage: "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/Dark%20Mode/sad-version.avif",
  },
  { slug: "relationships", label: "Relationships", image: gridPhoto("image (10)") },
  {
    slug: "grief",
    label: "Grief",
    image: gridPhoto("image (11)"),
    darkImage: "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/Dark%20Mode/sad-maya-planting.avif",
  },
  { slug: "sleep", label: "Sleep", image: gridPhoto("marco1") },
  { slug: "bipolar", label: "Bipolar disorder", image: illustration("maya-1") },
  {
    slug: "lgbtqia",
    label: "LGBTQIA+ affirming",
    image: illustration("maya-2"),
    darkImage: "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/Dark%20Mode/sad-maya-planting.avif",
  },
  {
    slug: "autism",
    label: "ASD",
    image: "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/Dark%20Mode/maya5-Photoroom.avif",
  },
  { slug: "ocd", label: "OCD", image: illustration("maya10") },
  { slug: "mania", label: "Mania", image: illustration("maya11") },
];

export function CareCarousel() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="max-w-xl text-balance font-display text-4xl font-bold tracking-tight text-primary sm:text-[40px] sm:leading-[1.08]">
          Care for life.
        </h2>
        <Link
          href="/providers"
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
            className="group/card relative flex aspect-[4/5] overflow-hidden rounded-card border border-page-edge bg-surface transition-colors hover:border-primary"
          >
            <div className="absolute inset-0">
              <WatercolorHover className="block h-full w-full">
                <img
                  src={c.image}
                  alt=""
                  className={`h-full w-full object-cover ${c.darkImage ? "care-img-light" : ""}`}
                  style={c.objectPosition ? { objectPosition: c.objectPosition } : undefined}
                  loading="lazy"
                />
                {c.darkImage && (
                  <img
                    src={c.darkImage}
                    alt=""
                    className="care-img-dark absolute inset-0 h-full w-full object-cover"
                    style={c.objectPosition ? { objectPosition: c.objectPosition } : undefined}
                    loading="lazy"
                  />
                )}
              </WatercolorHover>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-t from-black/75 via-black/15 to-transparent p-5 pt-12 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100">
              <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug text-white">{c.label}</h3>
              <div className="care-arrow-target pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary bg-white">
                <Icon
                  name="arrow-right"
                  size={20}
                  className="care-arrow-icon text-primary transition-transform duration-500"
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Light in-network logo strip — color insurance marks on a light ground,
// grayscale until hover. The single insurer band used across the marketing
// surface (home, /care topics, home-2). Marks live in the public blob store
// under logos/insurance/*.

const LOGO_BASE = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/logos/insurance";

// Only real, ready-to-use NY-relevant marks — skip logos/insurance assets that
// exist in the blob store but don't belong here: bcbs.avif (Massachusetts),
// horizon.avif (New Jersey), optum-unitedhealth.avif (a colored banner
// lockup, not a transparent mark — redundant with "united" anyway).
// Shared box height. Most marks carry baked-in whitespace, so at this height
// their glyphs sit comfortably. A couple of assets are cropped tight to the
// glyph (no padding) and read oversized at the shared height — those get a
// smaller per-logo `h` so every mark matches in *optical* size, not box size.
const BASE_H = "h-10 sm:h-12";

const INSURERS: Array<{ slug: string; name: string; ext?: string; h?: string }> = [
  { slug: "united", name: "UnitedHealthcare" },
  { slug: "aetna", name: "Aetna" },
  { slug: "anthem", name: "Anthem" },
  { slug: "cigna", name: "Cigna" },
  { slug: "carelon", name: "Carelon" },
  { slug: "optum-oscar", name: "Optum" },
  // Tightly cropped bold wordmarks — scaled down to match the others optically.
  // Humana is a single bold wordmark; Healthfirst is a 2-line lockup (wordmark +
  // tagline), so its box runs even smaller to bring the whole mark down to size.
  { slug: "humana", name: "Humana", h: "h-5 sm:h-6" },
  { slug: "healthfirst", name: "Healthfirst", ext: "svg", h: "h-4 sm:h-5" },
];

const GROUNDS = { surface: "bg-surface", page: "bg-page", wash: "bg-primary-wash" } as const;

export function InsurerStrip({
  caption = "In-network with the plans New Yorkers already carry.",
  ground = "surface",
}: {
  /** Pass "" to render no caption. */
  caption?: string;
  /** Band ground — "surface" (white), "page" (warm paper, care pages), or "wash" (mint, matches the home page's provider band). */
  ground?: keyof typeof GROUNDS;
}) {
  return (
    <section className={GROUNDS[ground]}>
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        {caption && <p className="text-center text-sm text-text-muted">{caption}</p>}
        {/* All 8 marks on a single centered row; wraps gracefully if the
            viewport can't hold them. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-6 sm:gap-x-10">
          {INSURERS.map((p) => (
            <img
              key={p.slug}
              src={`${LOGO_BASE}/${p.slug}.${p.ext ?? "avif"}`}
              alt={`${p.name} — accepted insurance`}
              className={`${p.h ?? BASE_H} w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0`}
              loading="lazy"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// Light in-network logo strip — the home page's own treatment (color insurance
// marks on white, grayscale until hover). Satisfies the brief's
// {{INSURER_LOGOS}} with the real blob assets already in use. NEW (public
// marketing site). Marks live in the public blob store, same source as the home
// page and TrustBand.

const LOGO_BASE = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/logos/insurance";

// Only real, ready-to-use NY-relevant marks — skip logos/insurance assets that
// exist in the blob store but don't belong here: bcbs.avif (Massachusetts),
// horizon.avif (New Jersey), optum-unitedhealth.avif (a colored banner
// lockup, not a transparent mark — redundant with "united" anyway).
const INSURERS = [
  { slug: "united", name: "UnitedHealthcare" },
  { slug: "aetna", name: "Aetna" },
  { slug: "anthem", name: "Anthem" },
  { slug: "cigna", name: "Cigna" },
  { slug: "carelon", name: "Carelon" },
  { slug: "optum-oscar", name: "Optum" },
  { slug: "humana", name: "Humana" },
  { slug: "healthfirst", name: "Healthfirst", ext: "svg" },
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
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {INSURERS.map((p) => (
            <img
              key={p.slug}
              src={`${LOGO_BASE}/${p.slug}.${p.ext ?? "avif"}`}
              alt={`${p.name} — accepted insurance`}
              className="h-10 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 sm:h-12"
              loading="lazy"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

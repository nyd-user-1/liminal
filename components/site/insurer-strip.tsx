// Light in-network logo strip — the home page's own treatment (color insurance
// marks on white, grayscale until hover). Satisfies the brief's
// {{INSURER_LOGOS}} with the real blob assets already in use. NEW (public
// marketing site). Marks live in the public blob store, same source as the home
// page and TrustBand.

const LOGO_BASE = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/logos/insurance";

const INSURERS = [
  { slug: "united", name: "UnitedHealthcare" },
  { slug: "aetna", name: "Aetna" },
  { slug: "anthem", name: "Anthem" },
  { slug: "cigna", name: "Cigna" },
  { slug: "carelon", name: "Carelon" },
  { slug: "optum-oscar", name: "Optum" },
];

export function InsurerStrip({
  caption = "In-network with the plans New Yorkers already carry.",
}: {
  caption?: string;
}) {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <p className="text-center text-sm text-text-muted">{caption}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {INSURERS.map((p) => (
            <img
              key={p.slug}
              src={`${LOGO_BASE}/${p.slug}.avif`}
              alt={`${p.name} — accepted insurance`}
              className="h-6 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 sm:h-7"
              loading="lazy"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// Navy trust band — white insurance marks, shown between the hero and the
// directory section as in-network social proof. Logos are white-monochrome
// AVIF in the public blob store (logos/insurance-white/*), normalized to a
// uniform box and rendered at a uniform height so the row reads evenly.

const WHITE_BASE = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/logos/insurance-white";

const PAYERS = [
  { slug: "aetna", name: "Aetna" },
  { slug: "anthem", name: "Anthem" },
  { slug: "bcbs", name: "Blue Cross Blue Shield" },
  { slug: "cigna", name: "Cigna" },
  { slug: "carelon", name: "Carelon" },
  { slug: "optum-oscar", name: "Optum" },
];

export function TrustBand() {
  return (
    <section className="bg-sidebar-bg">
      <div className="mx-auto w-full max-w-6xl px-6 py-11">
        <p className="text-center text-[13px] font-semibold uppercase tracking-[0.14em] text-sidebar-text">
          In-network with the plans you already have
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-12 gap-y-7">
          {PAYERS.map((p) => (
            <img
              key={p.slug}
              src={`${WHITE_BASE}/${p.slug}.avif`}
              alt={`${p.name} — accepted insurance`}
              className="h-6 w-auto opacity-80 transition-opacity hover:opacity-100 sm:h-7"
              loading="lazy"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

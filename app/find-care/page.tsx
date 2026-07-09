import { FindCareSearch } from "@/components/marketing/find-care-search";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Nav } from "@/components/marketing/nav";
import { providerFacets } from "@/lib/repos/directory";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Find care · Liminal",
  description: "Search licensed mental-health providers and programs across New York.",
};

const HERO_IMAGE = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/Gemini_Generated_Image_pyj40gpyj40gpyj4.avif";

// /find-care — the real search + results page (see find-care-search.tsx and
// find-care-result-card.tsx for the search logic and card rendering). Shell
// matches the homepage: warm bg-page ground, canonical Nav, and the
// /therapists hero pattern (image + gradient + overlaid H1) with the search
// dropped directly underneath it, crossroads-signpost art standing in for
// "choosing where to start."
export default async function FindCarePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string; specialty?: string }>;
}) {
  const { q, city, specialty } = await searchParams;
  const facets = await providerFacets();
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-card">
          <img
            src={HERO_IMAGE}
            alt="A watercolour illustration of a signpost at a crossroads in a meadow at dusk, two paths diverging toward the horizon."
            className="h-64 w-full object-cover sm:h-80"
            loading="eager"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          <h1 className="absolute bottom-6 left-8 font-display text-4xl font-extrabold tracking-tight text-white sm:left-12 sm:text-6xl">
            Find care
          </h1>
        </div>

        <div className="mt-10">
          <FindCareSearch initialQ={q ?? ""} initialCity={city ?? ""} initialSpecialty={specialty ?? ""} facets={facets} />
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

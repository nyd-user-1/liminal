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

// /find-care — the real search + results page (see find-care-search.tsx for
// the search logic, provider-spotlight-card.tsx for the cards). Shell matches
// the homepage: warm bg-page ground, canonical Nav, and the /therapists hero
// pattern (image + gradient + overlaid H1), crossroads-signpost art standing
// in for "choosing where to start."
//
// The hero is ordinary flow content — it scrolls up and away. The search group
// beneath it is what sticks (30px under the nav; see FindCareSearch), so the
// filters stay to hand while the result cards pass behind them. `pt-8` rather
// than the usual `py-12`: the hero has less to clear now that it isn't the
// thing pinning the search control down the page.
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-12 pt-8 sm:pb-16">
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

        <FindCareSearch initialQ={q ?? ""} initialCity={city ?? ""} initialSpecialty={specialty ?? ""} facets={facets} />
      </main>

      <MarketingFooter />
    </div>
  );
}

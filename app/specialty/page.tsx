import Link from "next/link";
import { Nav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { SpecialtyDirectory } from "@/components/marketing/specialty-directory";

export const metadata = {
  title: "Specialty · Leuk",
  description: "Browse New York mental-health providers by board-recognized clinical specialty.",
};

// /specialty — the /therapists directory-index pattern narrowed to a single
// "Specialty" tab. Where the /therapists Specialties tab lists curated marketing
// labels that link out as free-text q= search (and mostly miss), this browses
// the real NPPES subspecialty facet and links via the exact-match specialty=
// param, so every entry returns a populated /providers page. See
// components/marketing/specialty-directory.tsx.
export default function SpecialtyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-card">
          <img
            src="https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/library.avif"
            alt="A watercolour illustration of a library — tall bookshelves receding toward a light-filled arched corridor."
            className="h-64 w-full object-cover sm:h-80"
            loading="eager"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          <h1 className="absolute bottom-6 left-8 font-display text-4xl font-extrabold tracking-tight text-white sm:left-12 sm:text-6xl">
            Specialty
          </h1>
        </div>

        <p className="mt-6 max-w-3xl text-pretty leading-relaxed text-text-body">
          Leuk simplifies finding{" "}
          <Link href="/providers" className="text-primary underline underline-offset-2">
            in-network mental health providers
          </Link>{" "}
          by specialty. Browse by <span className="font-medium text-text">Specialty</span> — the licensed discipline a
          provider practices under — or by <span className="font-medium text-text">Sub-Specialty</span>, the
          board-recognized area of focus they carry beyond it. Every entry links to verified New York providers who list
          it in the state directory.
        </p>

        <div className="mt-10">
          <SpecialtyDirectory />
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

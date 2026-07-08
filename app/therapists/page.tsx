import Link from "next/link";
import { Nav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { TherapistDirectory } from "@/components/marketing/therapist-directory";

export const dynamic = "force-dynamic";

// /therapists — the directory index (Headway "Find a therapist" pattern), browse
// by NYC-Metro, county, city, or specialty. Lists not yet wired to sub-pages.
export default function TherapistsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:py-16">
        <div className="overflow-hidden rounded-card bg-primary-wash px-8 py-20 sm:px-14">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-primary-deep sm:text-6xl">
            Find a therapist
          </h1>
        </div>

        <p className="mt-6 max-w-3xl text-pretty leading-relaxed text-text-body">
          Liminal simplifies finding{" "}
          <Link href="/find-care" className="text-primary underline underline-offset-2">
            mental health providers who accept insurance
          </Link>{" "}
          by partnering with New York&apos;s top plans — including Aetna, Cigna, UnitedHealthcare, Empire BCBS, Fidelis
          Care, and Healthfirst. This network helps New Yorkers find affordable, in-network care. Browse by borough,
          county, city, or specialty below.
        </p>

        <div className="mt-10">
          <TherapistDirectory />
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

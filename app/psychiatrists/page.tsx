import Link from "next/link";
import { Nav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { TherapistDirectory } from "@/components/marketing/therapist-directory";

export const dynamic = "force-dynamic";

// /psychiatrists — same directory-index pattern as /therapists, scoped to the
// "Psychiatrist" profession (a distinct NPPES-normalized value from
// "Psychiatric Nurse Practitioner", which gets its own page at
// /psychiatric-np). Browse-by links carry &need=Psychiatrist into /find-care.
export default function PsychiatristsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-card">
          <img
            src="https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/Gemini_Generated_Image_pyj40gpyj40gpyj4.avif"
            alt=""
            className="h-64 w-full object-cover sm:h-80"
            loading="eager"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          <h1 className="absolute bottom-6 left-8 font-display text-4xl font-extrabold tracking-tight text-white sm:left-12 sm:text-6xl">
            Find a psychiatrist
          </h1>
        </div>

        <p className="mt-6 max-w-3xl text-pretty leading-relaxed text-text-body">
          Liminal simplifies finding{" "}
          <Link href="/find-care?need=Psychiatrist" className="text-primary underline underline-offset-2">
            psychiatrists who accept insurance
          </Link>{" "}
          by partnering with New York&apos;s top plans — including Aetna, Cigna, UnitedHealthcare, Empire BCBS, Fidelis
          Care, and Healthfirst. Psychiatrists diagnose and manage medication for anxiety, depression, ADHD, and other
          conditions — often alongside a therapist. Browse by borough, county, city, or specialty below.
        </p>

        <div className="mt-10">
          <TherapistDirectory profession="Psychiatrist" />
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

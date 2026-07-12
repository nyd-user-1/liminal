import Link from "next/link";
import { Nav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { TherapistDirectory } from "@/components/marketing/therapist-directory";

export const dynamic = "force-dynamic";

// /psychiatric-np — same directory-index pattern as /therapists, scoped to the
// "Psychiatric Nurse Practitioner" profession (a distinct NPPES-normalized
// value from "Psychiatrist", which gets its own page at /psychiatrists).
// Browse-by links carry &need=Psychiatric+Nurse+Practitioner into /providers.
export default function PsychiatricNpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-card">
          <img
            src="https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/Gemini_Generated_Image_v2kfp1v2kfp1v2kf.avif"
            alt=""
            className="h-64 w-full object-cover sm:h-80"
            loading="eager"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          <h1 className="absolute bottom-6 left-8 font-display text-4xl font-extrabold tracking-tight text-white sm:left-12 sm:text-5xl">
            Nurse Practitioner
          </h1>
        </div>

        <p className="mt-6 max-w-3xl text-pretty leading-relaxed text-text-body">
          Leuk simplifies finding{" "}
          <Link
            href="/providers?need=Psychiatric+Nurse+Practitioner"
            className="text-primary underline underline-offset-2"
          >
            psychiatric nurse practitioners who accept insurance
          </Link>{" "}
          by partnering with New York&apos;s top plans — including Aetna, Cigna, UnitedHealthcare, Empire BCBS, Fidelis
          Care, and Healthfirst. Psychiatric nurse practitioners (PMHNPs) can evaluate, diagnose, and prescribe
          medication for mental health conditions, often as a more accessible alternative to a psychiatrist. Browse by
          borough, county, city, or specialty below.
        </p>

        <div className="mt-10">
          <TherapistDirectory profession="Psychiatric Nurse Practitioner" />
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

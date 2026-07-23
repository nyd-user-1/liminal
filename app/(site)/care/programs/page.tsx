import Link from "next/link";
import type { Metadata } from "next";
import { Nav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Icon } from "@/components/ui/icons";
import { programFamilyFacets, type ProgramFamilyFacet } from "@/lib/repos/directory";
import { FAMILY_CONTENT } from "@/lib/program-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Programs & services · Leuk",
  description:
    "Browse New York's public mental-health programs — housing, clinics, crisis help, care management, peer support, and more — by county and who they're for.",
};

const HERO_IMAGE = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/library.avif";
const HERO_ALT =
  "A watercolour illustration of a library — tall bookshelves receding toward a light-filled arched corridor.";

// /programs — the index over the 10 patient-facing program families
// (lib/program-taxonomy.ts) built from OMH's 6,462 published programs. Marketing
// surface: warm-paper ground, canonical Nav + MarketingFooter, the /providers
// hero grammar (image + overlaid H1). Each card deep-links to its family page.
export default async function ProgramsIndexPage() {
  const families = await programFamilyFacets();

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-card">
          <img src={HERO_IMAGE} alt={HERO_ALT} className="h-64 w-full object-cover sm:h-80" loading="eager" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <h1 className="absolute bottom-6 left-8 font-display text-4xl font-extrabold tracking-tight text-white sm:left-12 sm:text-6xl">
            Programs &amp; services
          </h1>
        </div>

        <p className="mt-6 max-w-3xl text-pretty text-lg leading-relaxed text-text-body">
          New York runs thousands of mental-health programs — places to live, clinics, crisis help, care
          coordination, peer support, and more. We&apos;ve grouped them into ten plain-language categories so you can
          start from what you need, then narrow by county and who the program is for.
        </p>

        {/* Crisis fast-path — the highest-value shortcut, above the full grid. */}
        <CrisisBanner />

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {families.map((f) => (
            <FamilyCard key={f.slug} family={f} />
          ))}
        </div>

        <p className="mt-10 text-sm text-text-muted">
          Source: New York State Office of Mental Health. Program information is published by OMH and refreshed
          periodically; call a program to confirm current details before you go.
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}

function FamilyCard({ family }: { family: ProgramFamilyFacet }) {
  const ui = FAMILY_CONTENT[family.slug];
  return (
    <Link
      href={`/care/programs/family/${family.slug}`}
      className="group flex flex-col rounded-card border border-border bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-menu"
    >
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-field bg-primary-wash">
        <Icon name={ui?.icon ?? "hand-heart"} size={24} className="fill-surface text-primary" />
      </span>
      <h2 className="text-[19px] font-semibold text-text">{family.label}</h2>
      <p className="mt-1.5 flex-1 text-pretty text-[15px] leading-relaxed text-text-body">{family.blurb}</p>
      <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-text-muted">
        <span className="text-primary">{family.programCount.toLocaleString()}</span>
        {family.programCount === 1 ? "program" : "programs"} across {family.countyCount}{" "}
        {family.countyCount === 1 ? "county" : "counties"}
        <span aria-hidden className="ml-auto text-primary transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </p>
    </Link>
  );
}

function CrisisBanner() {
  return (
    <div className="mt-8 flex flex-col gap-4 rounded-card border border-warning/40 bg-warning-tint/50 p-6 sm:flex-row sm:items-center">
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-field bg-surface">
        <Icon name="phone" size={24} className="text-warning" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[19px] font-semibold text-text">In a crisis right now?</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-text-body">
          Call or text{" "}
          <a href="tel:988" className="font-semibold text-text underline underline-offset-2">
            988
          </a>{" "}
          — the Suicide &amp; Crisis Lifeline, free and available 24/7. If someone&apos;s life is in danger, call 911.
        </p>
      </div>
      <Link
        href="/care/programs/family/crisis"
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-field bg-primary px-5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover"
      >
        See crisis resources
      </Link>
    </div>
  );
}

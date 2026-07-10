import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { CareCarousel } from "@/components/marketing/care-carousel";
import { HeroSearch } from "@/components/marketing/hero-search";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Nav } from "@/components/marketing/nav";
import { ProviderCta } from "@/components/marketing/provider-cta";
import { ProviderSpotlightRail, type ProviderSpotlight } from "@/components/marketing/provider-spotlight-card";
import { silhouetteUrl } from "@/components/providers/provider-illustration";
import { Reveal } from "@/components/marketing/reveal";
import { ReviewsCarousel, type Review } from "@/components/marketing/reviews-carousel";
import { ScrollCue } from "@/components/marketing/scroll-cue";
import { TherapistSearchCta } from "@/components/marketing/therapist-search-cta";
import { WatercolorHover } from "@/components/marketing/watercolor-hover";
import { WatercolorPlayground } from "@/components/marketing/watercolor-playground";
import { getProfileByUserId, nextAvailableLabel, spotlightRatingFor } from "@/lib/repos/provider-profiles";
import { listAvailability, listPractitioners } from "@/lib/repos/services";

export const dynamic = "force-dynamic";

// Spotlight-card placeholder art: the same painted silhouette busts the
// directory rows use (see provider-illustration.tsx). Seeded off the card id
// rather than drawn at random, so a given provider doesn't switch bodies
// between page loads — `dynamic = "force-dynamic"` above means every load is a
// fresh render.

// Home — "First Light" redesign.
// ────────────────────────────────────────────────────────────────────────────
// The old page floated the watercolours on a cream "paper" ground (the 2026 AI
// default) and braided patient→provider→patient down a very long scroll. This
// version commits to three things:
//   1. Patient-first. The find-care job is the loudest thing on the page; the
//      provider pitch is one concentrated band (#for-providers), never a braid.
//   2. A warm paper ground (--color-page, #f7f3e8) the watercolours dissolve
//      into. Warmth is carried by the paper, the amber accent, and the paintings'
//      own light; distinctiveness rides the type, layout, and the dusk band.
//   3. Headings in the Bricolage grotesque (font-display, extrabold/bold);
//      body in Inter. One assured display voice, no serif.
// A dusk-teal CTA closes the page and continues into the footer as one dark
// block (MarketingFooter's bg is overridden to the same dusk).

// Blob illustration hosts. CUT = background-removed watercolour scenes
// (transparent, soft deckled edges) that dissolve into the warm paper with no
// box; ILLO = framed scenes (e.g. the dusk landscapes) that carry their own edge.
const ILLO = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations";
const CUT = `${ILLO}/cut`;

// The find-care entry points. Each row is a real directory query; the whole
// section is the page's conversion spine, so it leads (not the mood).
const SPECIALTIES: Array<{ name: string; note: string; q: string }> = [
  { name: "Anxiety & depression", note: "The most-searched reason to reach out", q: "Anxiety and Depression" },
  { name: "Trauma & PTSD", note: "EMDR, CPT, trauma-informed clinicians", q: "Trauma and PTSD" },
  { name: "ADHD", note: "Evaluation, coaching, and medication", q: "ADHD" },
  { name: "Couples & family", note: "Relationships and family dynamics", q: "Couples" },
  { name: "Grief & loss", note: "Bereavement and major life change", q: "Grief and Loss" },
  { name: "LGBTQIA+ affirming", note: "Care that centers who you are", q: "LGBTQIA+" },
];

// The find-care flow, as an honest ordered sequence (numbers earn their place).
const STEPS: Array<{ n: string; title: string; body: string; icon: IconName }> = [
  {
    n: "01",
    title: "Search & filter",
    body: "Search 116,000+ providers by specialty, borough, and your exact insurance plan. No account needed.",
    icon: "search",
  },
  {
    n: "02",
    title: "See your cost up front",
    body: "Know what a visit costs before you book. In-network means no surprise bill after the session.",
    icon: "check",
  },
  {
    n: "03",
    title: "Book the same week",
    body: "Pick a real open slot and confirm online — many providers can see you within the week.",
    icon: "calendar-check",
  },
];

// Reach stats (Headway "found support" layout, Liminal content). Provider count
// held at 116,000+ to match the hero rather than Headway's 70K+.
const STATS: Array<{ n: string; label: string; body: string }> = [
  {
    n: "30M+",
    label: "sessions held",
    body: "Millions of meaningful care moments — connecting people to the personalized support they need.",
  },
  {
    n: "116,000+",
    label: "licensed providers",
    body: "No matter what you’re facing, Liminal helps you find a therapist or psychiatrist who’s ready to help.",
  },
];

// Review rail — first three are the original social quotes; the rest are
// placeholder testimonials in the same voice (swap for real ones). Each gets a
// short title in the teal display style.
const REVIEWS: Review[] = [
  {
    name: "Rachel Bouton",
    title: "It just works",
    text: "You plug in your insurance and Liminal lists therapists who take it — then handles all the payment and billing for you.",
  },
  {
    name: "Caiti Donovan",
    title: "Found the right fit",
    text: "I found my therapist through Liminal and love her. It takes the hassle out of insurance and payment so you focus on fit.",
  },
  {
    name: "tikh",
    title: "Highly recommend",
    text: "Woah, def recommend this for anyone looking for a therapist — Liminal made the whole thing painless.",
  },
  {
    name: "Marcus Lee",
    title: "Booked the same week",
    text: "I picked a real open time and booked online — my first session was that same week. No waitlist, no phone tag.",
  },
  {
    name: "Priya N.",
    title: "No surprise bills",
    text: "I filtered by my plan and saw the cost before booking. In-network meant exactly that — no surprise bill later.",
  },
  {
    name: "Deja W.",
    title: "Care that gets me",
    text: "Finding someone who understood my background mattered. I filtered for it and clicked on the first try.",
  },
  {
    name: "Sam Rivera",
    title: "Ten minutes, done",
    text: "The whole thing took about ten minutes. I fully expected to give up halfway through like every other time.",
  },
  {
    name: "Hannah K.",
    title: "No more phone tag",
    text: "My old routine was calling ten offices to ask if they took my plan. Liminal just showed me the ones that did.",
  },
  {
    name: "Andre T.",
    title: "I told my friends",
    text: "I’ve already sent it to three friends. It’s the first time getting care felt easy instead of exhausting.",
  },
];

// ── Provider spotlight rail (replaces the testimonial cards in the first
// "Reach" section — Image 1's cards, turned into real provider cards). Real
// bookable demo practitioners get their live profile + availability; rating/
// review-count comes from spotlightRatingFor (lib/repos/provider-profiles —
// no backing field yet, authored there, shared with the real provider page).
// The rest of the rail is entirely authored copy for providers that don't
// exist in the DB yet (minimum-9-cards ask) — their CTAs point at /providers
// rather than a dead profile link.

const FICTIONAL_SPOTLIGHT: ProviderSpotlight[] = [
  {
    id: "spotlight-amara",
    name: "Dr. Amara Okafor",
    credentialLine: "PMHNP · 8 years of experience",
    rating: 4.9,
    reviewCount: 142,
    availableLabel: "Fri, Jul 10",
    quote: "I want you to feel like a partner in your own care, not a passenger — we’ll figure out what’s working together.",
    specialties: ["Medication management", "ADHD", "Anxiety"],
    moreCount: 6,
    careType: "medication",
    illustrationKey: "liminal_4ji9244ji9244ji9",
    href: "/providers",
  },
  {
    id: "spotlight-jordan",
    name: "Jordan Kessler",
    credentialLine: "LMFT · 11 years of experience",
    rating: 5.0,
    reviewCount: 98,
    availableLabel: "Mon, Jul 13",
    quote: "Most couples don’t need to fall back in love — they need better tools to fight fair and actually hear each other.",
    specialties: ["Couples counseling", "Family conflict", "Communication"],
    moreCount: 5,
    careType: "therapy",
    illustrationKey: "liminal-9",
    href: "/providers",
  },
  {
    id: "spotlight-naomi",
    name: "Dr. Naomi Chen",
    credentialLine: "Clinical Psychologist, PhD · 16 years of experience",
    rating: 4.9,
    reviewCount: 211,
    availableLabel: "Tue, Jul 14",
    quote: "Healing from trauma isn’t about forgetting — it’s about the memory finally losing its grip on your nervous system.",
    specialties: ["Trauma & PTSD", "EMDR", "Grief"],
    moreCount: 4,
    careType: "therapy",
    illustrationKey: "liminal_a2t92la2t92la2t9",
    href: "/providers",
  },
  {
    id: "spotlight-malik",
    name: "Malik Owens",
    credentialLine: "LCSW · 6 years of experience",
    rating: 4.8,
    reviewCount: 76,
    availableLabel: "Wed, Jul 15",
    quote: "A lot of men get to me after years of white-knuckling it — my job is to show you there’s a better way to carry it.",
    specialties: ["Men’s mental health", "Anger management", "Career & burnout"],
    moreCount: 3,
    careType: "therapy",
    illustrationKey: "liminal_n1y3w0n1y3w0n1y3",
    href: "/providers",
  },
  {
    id: "spotlight-sofia",
    name: "Dr. Sofia Reyes",
    credentialLine: "LMHC · 9 years of experience",
    rating: 5.0,
    reviewCount: 134,
    availableLabel: "Thu, Jul 16",
    quote: "Teenagers can smell a script from a mile away — I just try to be a real adult who actually listens.",
    specialties: ["Teens", "Anxiety", "School stress"],
    moreCount: 4,
    careType: "therapy",
    illustrationKey: "maya11",
    href: "/providers",
  },
];

// Section 6 — NY-focused insurance plans (colours approximate each brand).
const INSURERS: Array<{ name: string; color: string }> = [
  { name: "Aetna", color: "text-[#7d3f98]" },
  { name: "Cigna", color: "text-[#00799e]" },
  { name: "UnitedHealthcare", color: "text-[#0067b9]" },
  { name: "Empire BCBS", color: "text-[#0079c1]" },
  { name: "Fidelis Care", color: "text-[#00843d]" },
  { name: "Healthfirst", color: "text-[#003a70]" },
];

// Section 7 — the getting-started steps.
const HOW_IT_WORKS: Array<{ title: string; body: string }> = [
  {
    title: "Find the right fit",
    body: "Share your preferences and we'll filter through 116,000+ therapists and psychiatrists to find your matches.",
  },
  {
    title: "Get the in-network price",
    body: "Add your insurance details so we can estimate your cost — before you book.",
  },
  {
    title: "Book your session",
    body: "Book right on Liminal — we'll handle everything from there. You'll only be billed after your session.",
  },
];

export default async function Home() {
  const practitioners = await listPractitioners();
  const realSpotlights = (
    await Promise.all(
      practitioners
        .filter((pr) => spotlightRatingFor(pr.slug))
        .map(async (pr): Promise<ProviderSpotlight | null> => {
          const [profile, availability] = await Promise.all([getProfileByUserId(pr.id), listAvailability(pr.id)]);
          if (!profile) return null;
          const meta = spotlightRatingFor(pr.slug)!;
          const isPrescriber =
            (profile.roleTitle?.toLowerCase().includes("psychiatr") ?? false) ||
            profile.topSpecialties.some((s) => s.toLowerCase().includes("medication"));
          return {
            id: pr.id,
            name: pr.name,
            credentialLine: `${profile.licenseType ?? profile.roleTitle ?? "Therapist"} · ${profile.yearsExperience ?? 0} year${profile.yearsExperience === 1 ? "" : "s"} of experience`,
            rating: meta.rating,
            reviewCount: meta.reviewCount,
            availableLabel: nextAvailableLabel(availability.map((a) => a.weekday)),
            quote: profile.styleIs ?? "",
            specialties: profile.topSpecialties.slice(0, 3),
            moreCount: profile.moreSpecialties.length,
            careType: isPrescriber ? "medication" : "therapy",
            illustrationKey: profile.illustrationKey,
            avatarHue: pr.avatarHue,
            href: `/providers/${pr.slug}`,
          };
        }),
    )
  ).filter((p): p is ProviderSpotlight => p !== null && p.quote !== "");
  const spotlightProviders = [...realSpotlights, ...FICTIONAL_SPOTLIGHT].map((p) => ({
    ...p,
    photoUrl: silhouetteUrl(p.id),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />

      {/* ── Hero — the promise + the search, on first light ────────────────── */}
      <section className="relative overflow-hidden bg-page lg:flex lg:min-h-[calc(100svh-72px)] lg:items-center">
        {/* first-light wash — soft teal bloom on the right, feathered edges */}
        <div aria-hidden className="mkt-firstlight pointer-events-none absolute inset-0" />

        {/* large hero painting, bleeding off the right (desktop) — pointer events
            enabled so the watercolour bloom can track the cursor over it */}
        <div className="absolute top-1/2 right-0 z-0 hidden w-[54vw] max-w-[920px] -translate-y-1/2 lg:block">
          <WatercolorHover>
            <img
              src={`${CUT}/lakeside.avif`}
              alt="A watercolour illustration — a person wrapped in a shawl sits on a bench by a still lake at dawn, holding a warm mug."
              width={1600}
              height={1200}
              className="mkt-develop mkt-d1 block w-full"
              loading="eager"
            />
          </WatercolorHover>
        </div>

        <div className="pointer-events-none relative z-10 mx-auto w-full max-w-6xl px-6 py-16 sm:py-20 lg:py-16">
          <div className="pointer-events-auto lg:max-w-[54%]">
            <h1
              className="mkt-rise text-balance font-display font-extrabold tracking-[-0.03em] text-text"
              style={{ fontSize: "clamp(2.75rem, 6vw, 5.25rem)", lineHeight: 1.01 }}
            >
              Healing belongs to{" "}
              <span className="text-primary">everyone.</span>
            </h1>
            <p className="mkt-rise mkt-d1 mt-6 max-w-lg text-pretty text-lg leading-relaxed text-text-body sm:text-xl">
              Search 116,000+ licensed therapists and psychiatrists across New York — filter by your insurance, see your
              cost before you book, and start as soon as this week.
            </p>
            <div className="mkt-rise mkt-d2 mt-8 max-w-[577px]">
              <HeroSearch autoFocus />
            </div>
            <p className="mkt-rise mkt-d3 mt-4 flex items-center gap-2 text-sm text-text-body">
              <Icon name="lock" size={15} className="shrink-0 text-primary" />
              Free to search — no sign-up required.
            </p>
          </div>

          {/* mobile painting */}
          <div className="mkt-develop mt-10 lg:hidden">
            <img
              src={`${CUT}/lakeside.avif`}
              alt="A watercolour illustration — a person wrapped in a shawl sits on a bench by a still lake at dawn, holding a warm mug."
              width={1600}
              height={1200}
              className="block w-full"
              loading="eager"
            />
          </div>
        </div>

        {/* scroll cue — fades/rises in after load, out on first scroll (client) */}
        <ScrollCue />
      </section>

      {/* ── Reach — stats + social proof (Headway "found support" layout) ──── */}
      <section id="reach" className="relative scroll-mt-24 overflow-hidden bg-page">
        <div className="mx-auto w-full max-w-6xl px-6 pt-10 sm:pt-12">
          <Reveal className="text-center">
            <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-primary sm:text-5xl">
              Millions have found support
            </h2>
          </Reveal>

          <div className="mt-8 grid items-center gap-6 lg:grid-cols-[1.3fr_1.1fr] lg:gap-10">
            <Reveal className="order-last lg:order-first lg:-ml-10 xl:-ml-20" delay={80}>
              <WatercolorHover className="mx-auto block w-full max-w-xl lg:max-w-none">
                <img
                  src={`${ILLO}/maya10.avif`}
                  alt="A watercolour illustration — two people walk a small dog along a path through a meadow at dawn, soft light on the horizon."
                  width={2030}
                  height={1211}
                  className="mkt-soft block w-full"
                  loading="lazy"
                />
              </WatercolorHover>
            </Reveal>

            <Reveal delay={220}>
              <ol className="flex flex-col justify-center gap-4">
                {HOW_IT_WORKS.map((s, i) => (
                  <li key={s.title} className="flex gap-4">
                    <span className="mt-0.5 w-7 shrink-0 font-display text-lg font-bold text-primary-deep">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-text">{s.title}</h3>
                      <p className="mt-1 text-pretty leading-relaxed text-text-body">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </div>

        <Reveal className="pt-8 pb-10 sm:pb-12">
          <ProviderSpotlightRail providers={spotlightProviders} />
        </Reveal>
      </section>

      {/* ══ Sections 3–9 (Headway-pattern) — inserted above the existing content;
          to be reconciled with the sections below. ═══════════════════════════ */}

      {/* ── 3 · Find care carousel ────────────────────────────────────────── */}
      <section className="bg-page py-16 sm:py-20">
        <Reveal>
          <CareCarousel />
        </Reveal>
      </section>

      {/* ── 4 · Reach, inverted — stats left, image right, cards bleed left ─── */}
      <section className="relative overflow-hidden bg-page">
        <div className="mx-auto w-full max-w-6xl px-6 pt-10 sm:pt-12">
          <Reveal className="text-center">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-primary-deep">
              Through Liminal
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-bold tracking-tight text-primary sm:text-5xl">
              Millions have found support
            </h2>
          </Reveal>

          <div className="mt-8 grid items-center gap-6 lg:grid-cols-[1fr_1.4fr] lg:gap-10">
            <Reveal delay={220}>
              <dl className="flex flex-col justify-center">
                {STATS.map((s, i) => (
                  <div key={s.n} className={`py-5 ${i > 0 ? "border-t border-page-edge" : ""}`}>
                    <dt className="font-display text-[44px] font-extrabold leading-none tracking-tight text-text sm:text-[50px]">
                      {s.n}
                    </dt>
                    <p className="mt-2 font-display text-base font-semibold text-text">{s.label}</p>
                    <dd className="mt-2 max-w-md text-pretty leading-relaxed text-text-body">{s.body}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
            <Reveal className="lg:-mr-10 xl:-mr-20" delay={80}>
              <WatercolorHover className="mx-auto block w-full max-w-xl lg:max-w-none">
                <img
                  src={`${CUT}/tending-seedling.avif`}
                  alt="A watercolour illustration — a person kneels in a garden bed, planting a seedling, a watering can beside them."
                  width={1600}
                  height={1120}
                  className="mkt-soft block w-full"
                  loading="lazy"
                />
              </WatercolorHover>
            </Reveal>
          </div>
        </div>

        <Reveal className="pt-10 pb-12 sm:pb-14">
          <ReviewsCarousel reviews={REVIEWS} bleed="left" />
        </Reveal>
      </section>

      {/* ── 5 · Use your insurance ────────────────────────────────────────── */}
      <section className="bg-page py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <WatercolorHover className="mx-auto block w-full max-w-lg">
              <img
                src={`${CUT}/grounding.avif`}
                alt="A watercolour illustration — a person kneels with their hands resting on the earth in soft light."
                width={1200}
                height={1200}
                className="block w-full"
                loading="lazy"
              />
            </WatercolorHover>
          </Reveal>
          <Reveal delay={100} className="max-w-md">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-primary-deep">
              Use your insurance
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-bold tracking-tight text-primary sm:text-[42px] sm:leading-[1.1]">
              See how much you save on sessions
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-text-body">
              Our clients save an average of 60% on sessions through Liminal. We&apos;ll work with your insurance so you
              can focus on your care, without worrying about cost.
            </p>
            <Link
              href="/providers"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-field border border-border bg-surface px-6 text-[15px] font-medium text-text transition-colors hover:border-primary hover:text-primary"
            >
              Find your price
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── 6 · Covered by insurance ──────────────────────────────────────── */}
      <section className="bg-page py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Reveal>
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-primary-deep">
              Statewide access
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-bold tracking-tight text-primary sm:text-5xl">
              Get mental health care, covered by insurance
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-pretty leading-relaxed text-text-body">
              We partner with 100+ of New York&apos;s top insurance plans so you can get the affordable care you need.
              Our network offers both in-person and virtual care across 40+ languages.
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-14 grid grid-cols-2 items-center gap-x-8 gap-y-12 sm:grid-cols-3">
            {INSURERS.map((ins) => (
              <span key={ins.name} className={`font-display text-2xl font-semibold sm:text-[28px] ${ins.color}`}>
                {ins.name}
              </span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── 7 · How it works ──────────────────────────────────────────────── */}
      <section className="bg-page py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <WatercolorHover className="mx-auto block w-full max-w-lg">
              <img
                src={`${CUT}/tending-seedling.avif`}
                alt="A watercolour illustration — a person kneels in a garden bed, planting a seedling."
                width={1600}
                height={1120}
                className="block w-full"
                loading="lazy"
              />
            </WatercolorHover>
          </Reveal>
          <Reveal delay={100} className="max-w-lg">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-primary-deep">
              Getting started
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-primary sm:text-5xl">How it works</h2>
            <ol className="mt-8 space-y-6">
              {HOW_IT_WORKS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="mt-0.5 w-7 shrink-0 font-display text-lg font-bold text-primary-deep">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-text">{s.title}</h3>
                    <p className="mt-1 text-pretty leading-relaxed text-text-body">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <form action="/providers" className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SearchInput name="q" placeholder="Enter your ZIP code" className="flex-1" />
              <Button type="submit" className="h-10 shrink-0">
                Find your provider
              </Button>
            </form>
          </Reveal>
        </div>
      </section>

      {/* ── 8 · Provider CTA band (reusable → design system) ──────────────── */}
      <section className="bg-page py-16 sm:py-20">
        <Reveal>
          <ProviderCta />
        </Reveal>
      </section>

      {/* ── 9 · Find a therapist CTA (reusable → design system) ───────────── */}
      <section className="bg-page py-16 sm:py-20">
        <Reveal>
          <TherapistSearchCta />
        </Reveal>
      </section>

      {/* ── Find care — the conversion spine: browse by what you're facing ─── */}
      <section className="bg-page">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
            {/* Col 1 — heading stacked on the image */}
            <div>
              <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-primary sm:text-[40px] sm:leading-[1.08]">
                Find care for whatever&apos;s on your mind.
              </h2>
              <Reveal className="mt-8">
                <WatercolorHover>
                  <img
                    src={`${CUT}/one-thing.avif`}
                    alt="A watercolour illustration — a mug, an open journal reading “one thing at a time”, and a laptop in soft morning light."
                    width={1600}
                    height={1120}
                    className="block w-full"
                    loading="lazy"
                  />
                </WatercolorHover>
              </Reveal>
              <Link href="/providers" className="group mt-6 inline-flex items-center text-[15px] font-semibold text-primary">
                <span className="link-wipe">Browse the full directory</span>
              </Link>
            </div>

            {/* Cols 2–3 — care categories split across two columns */}
            <ul className="grid gap-x-10 self-start sm:grid-cols-2 lg:col-span-2">
              {SPECIALTIES.map((s) => (
                <li key={s.name}>
                  <Link
                    href={`/providers?q=${encodeURIComponent(s.q)}`}
                    className="group block border-b border-page-edge py-4"
                  >
                    <span className="font-display text-lg font-semibold text-text transition-colors group-hover:text-primary">
                      {s.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-text-body/80">{s.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── How it works — three honest steps (fixes "will this actually work?") */}
      <section className="bg-page">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
          <h2 className="max-w-xl text-balance font-display text-4xl font-bold tracking-tight text-primary sm:text-5xl">
            Getting care shouldn&apos;t be the hard part.
          </h2>
          <p className="mt-4 max-w-lg text-pretty text-lg leading-relaxed text-text-body">
            No phone tag, no waitlists, no guessing what it&apos;ll cost. Three steps, and you&apos;re booked.
          </p>

          <ol className="mt-16 grid gap-x-12 gap-y-12 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n}>
                <div className="flex items-center gap-3">
                  <span className="font-display text-3xl font-semibold text-primary/40">{s.n}</span>
                  <span className="h-px flex-1 bg-page-edge" />
                  <Icon name={s.icon} size={20} className="shrink-0 text-primary" />
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold text-text">{s.title}</h3>
                <p className="mt-2 text-pretty leading-relaxed text-text-body">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Human proof — one quote, in the serif voice ────────────────────── */}
      <section className="bg-page">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-24 sm:py-28 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <WatercolorHover>
              <img
                src={`${CUT}/resting-meadow.avif`}
                alt="A watercolour illustration — a person lies back in tall grass, hands behind their head, eyes closed, at ease."
                width={1600}
                height={1120}
                className="block w-full"
                loading="lazy"
              />
            </WatercolorHover>
          </Reveal>
          <figure className="lg:pr-6">
            <blockquote className="text-balance font-display text-[26px] font-semibold leading-[1.3] tracking-tight text-text sm:text-[32px]">
              “I filtered to Brooklyn, teletherapy, and my insurance — and booked a first session for the same week. No
              phone tag, no waitlist.”
            </blockquote>
            <figcaption className="mt-6 font-display text-[15px] font-medium text-text-body">
              Dana R. <span className="text-text-body/60">— client in Brooklyn</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── Provider band — the single provider moment, on the mint wash ───── */}
      <section id="for-providers" className="scroll-mt-20 bg-primary-wash">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-24 sm:py-28 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-md">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-primary-deep">
              For providers
            </p>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-primary sm:text-[40px] sm:leading-[1.08]">
              Run your New York practice on Liminal.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-text-body">
              Scheduling, telehealth, AI progress notes, and billing on one platform — plus a directory that sends you
              clients. The practice behind the care can go home on time.
            </p>
            <div className="mt-8">
              <Link href="/join" className="group inline-flex items-center text-[15px] font-semibold text-primary-deep">
                <span className="link-wipe">Join as a provider</span>
              </Link>
            </div>
          </div>
          <Reveal className="lg:order-last">
            <WatercolorHover>
              <img
                src="https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/Gemini_Generated_Image_tep72ltep72ltep7-Photoroom.avif"
                alt="A watercolour illustration — a doctor's office desk with a stethoscope on a clipboard, a succulent, and a sweater draped over a chair."
                width={2400}
                height={1309}
                className="block w-full"
                loading="lazy"
              />
            </WatercolorHover>
          </Reveal>
        </div>
      </section>

      {/* ── Closing patient CTA — two-col: painting, then the invitation ───── */}
      <section className="bg-page">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-24 sm:py-28 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <WatercolorHover>
              <img
                src={`${CUT}/walking-together.avif`}
                alt="A watercolour illustration — two people walk a small dog along a stream toward soft morning light."
                width={1600}
                height={1000}
                className="block w-full"
                loading="lazy"
              />
            </WatercolorHover>
          </Reveal>
          <div className="max-w-md lg:pr-6">
            <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-primary sm:text-5xl">
              Find care without the guesswork.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-text-body">
              Search by specialty, borough, and coverage — and take the first step this week.
            </p>
            <div className="mt-8">
              <Link
                href="/providers"
                className="group inline-flex h-12 items-center justify-center gap-1.5 rounded-field bg-primary px-7 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                Find your provider
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing dusk CTA — the last invitation; the dark teal continues
          into the footer as one block (footer bg is overridden to match). ──── */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(120% 90% at 80% 12%, color-mix(in oklab, var(--color-accent) 20%, transparent) 0%, transparent 45%), linear-gradient(to bottom, var(--color-dusk) 0%, var(--color-dusk-deep) 100%)",
        }}
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-24 sm:py-28 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-md">
            <h2
              className="text-balance font-display font-extrabold tracking-[-0.03em] text-[#f4efe6]"
              style={{ fontSize: "clamp(2.25rem, 4.8vw, 3.75rem)", lineHeight: 1.06 }}
            >
              Whenever you&apos;re ready, we&apos;re here.
            </h2>
            <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-[#c9d6d4]">
              You don&apos;t have to have it all figured out. Search when you&apos;re ready — the first step is smaller than
              it looks.
            </p>
            <div className="mt-8">
              <Link
                href="/providers"
                className="group inline-flex h-12 items-center justify-center gap-1.5 rounded-field bg-accent px-7 text-[15px] font-semibold text-[#12292f] transition-colors hover:bg-[#e7a244]"
              >
                Find your provider
              </Link>
            </div>
          </div>

          <div className="relative lg:order-last lg:-mr-6">
            <WatercolorHover>
              <img
                src={`${CUT}/dusk-lake.avif`}
                alt="A watercolour illustration — a person sits by a lake beneath a bare tree at dusk, a warm band of light along the horizon."
                width={1600}
                height={900}
                className="mkt-soft block w-full"
                loading="lazy"
              />
            </WatercolorHover>
          </div>
        </div>
      </section>

      <MarketingFooter />

      {/* Live watercolor tuner — visitors can explore the illustration bloom. */}
      <WatercolorPlayground />
    </div>
  );
}

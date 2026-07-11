import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { ProviderSpotlightRail, type ProviderSpotlight } from "@/components/marketing/provider-spotlight-card";
import { WatercolorHover } from "@/components/marketing/watercolor-hover";
import { CtaLink } from "./cta-link";
import { Section, SectionHeading } from "./section";
import { InsurerStrip } from "./insurer-strip";
import { FaqList } from "./faq";
import { CtaBand } from "./cta-band";
import { Placeholder } from "./placeholder";
import { HOME_FAQS, BOOK_HREF, type Topic } from "@/lib/site-content";

// Shared template for every /care/[topic] page — condition and care-type alike.
// Section order per the brief: first-person hero → what care looks like →
// matching providers → cost/insurance → first-visit → FAQ → CTA. Reuses the
// homepage building blocks; invents nothing new. NEW (public marketing site).

// Care hero watercolours — background-removed "cut" illustrations that bleed off
// the right on the warm-paper ground, matching the home hero. Per-topic where we
// have a fitting scene; the lakeside default otherwise.
const DEFAULT_HERO_ILLO = {
  src: "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/cut/lakeside.avif",
  alt: "A watercolour illustration — a person wrapped in a shawl sits on a bench by a still lake at dawn, holding a warm mug.",
  width: 1600,
  height: 1200,
};

const HERO_ILLO_BY_SLUG: Record<string, { src: string; alt: string; width: number; height: number }> = {
  anxiety: {
    src: "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/cut/moonlit-dock.avif",
    alt: "A watercolour illustration — a wooden dock reaching into a still lake at night, a full moon and its soft reflection on the dark water.",
    width: 1024,
    height: 559,
  },
  adhd: {
    src: "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/cut/veranda.avif",
    alt: "A watercolour illustration — a columned porch lined with rocking chairs and ceiling fans, the veranda receding toward a calm green lawn.",
    width: 1024,
    height: 559,
  },
  relationships: {
    src: "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/cut/sunroom.avif",
    alt: "A watercolour illustration — a garden sunroom at dusk, two wicker chairs and a small table beside tall windows opening onto greenery.",
    width: 1024,
    height: 559,
  },
  sleep: {
    src: "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/cut/pantry.avif",
    alt: "A watercolour illustration — a warm-lit pantry at night, shelves of jars glowing under a single hanging lamp.",
    width: 1024,
    height: 559,
  },
  bipolar: {
    src: "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/cut/laundry.avif",
    alt: "A watercolour illustration — a sunlit laundry room, an unfolded pile beside neatly folded stacks on a counter by a garden window.",
    width: 1024,
    height: 559,
  },
};

export function CareTemplate({
  topic,
  providerCount,
  spotlightProviders,
}: {
  topic: Topic;
  providerCount?: number;
  spotlightProviders: ProviderSpotlight[];
}) {
  const browseHref = `/providers?q=${encodeURIComponent(topic.matchQuery)}`;
  const heroIllo = HERO_ILLO_BY_SLUG[topic.slug] ?? DEFAULT_HERO_ILLO;

  return (
    <>
      {/* Hero — the home page's grammar: warm-paper ground, a large watercolour
          bleeding off the right (cursor-tracking bloom + develop-in), the copy
          on the left, sized to fill the viewport under the nav. */}
      <section className="relative overflow-hidden bg-page lg:flex lg:min-h-[calc(100dvh-72px)] lg:items-center">
        <div aria-hidden className="mkt-firstlight pointer-events-none absolute inset-0" />

        {/* large hero painting, bleeding off the right (desktop) */}
        <div className="absolute top-1/2 right-0 z-0 hidden w-[72vw] max-w-[1280px] -translate-y-1/2 lg:block">
          <WatercolorHover>
            <img
              src={heroIllo.src}
              alt={heroIllo.alt}
              width={heroIllo.width}
              height={heroIllo.height}
              className="mkt-develop mkt-d1 block w-full"
              loading="eager"
            />
          </WatercolorHover>
        </div>

        {/* Left scrim — keeps the copy legible over the dark painting and lets the
            watercolour dissolve into the warm paper on the left. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-3/5 bg-gradient-to-r from-page via-page/80 to-transparent lg:block"
        />

        <div className="pointer-events-none relative z-10 mx-auto w-full max-w-6xl px-6 py-16 sm:py-20 lg:py-16">
          {/* mobile painting — leads the copy below lg */}
          <div className="pointer-events-auto mkt-develop -mx-6 mb-10 w-[calc(100%+3rem)] lg:hidden">
            <WatercolorHover>
              <img
                src={heroIllo.src}
                alt={heroIllo.alt}
                width={heroIllo.width}
                height={heroIllo.height}
                className="block w-full"
                loading="eager"
              />
            </WatercolorHover>
          </div>

          <div className="pointer-events-auto lg:max-w-[54%]">
            <p className="mkt-rise text-xs font-semibold uppercase tracking-[0.18em] text-primary">{topic.eyebrow}</p>
            <h1
              className="mkt-rise mkt-d1 mt-4 text-balance font-display font-extrabold tracking-[-0.02em] text-text"
              style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.03 }}
            >
              {topic.firstPerson}
            </h1>
            <p className="mkt-rise mkt-d2 mt-5 max-w-xl text-pretty text-lg leading-relaxed text-text-body sm:text-xl">
              {topic.lede}
            </p>
            <div className="mkt-rise mkt-d3 mt-8 flex flex-col gap-3 sm:flex-row">
              <CtaLink href={BOOK_HREF} arrow>
                Book a session
              </CtaLink>
              <CtaLink href={browseHref} tone="secondary">
                Browse providers
              </CtaLink>
            </div>
          </div>
        </div>
      </section>

      {/* Matching providers — section 2: the real homepage spotlight rail
          (full-bleed horizontal scroll) + a link into the full directory. */}
      <section className="bg-page pb-16 pt-10 sm:pb-20 sm:pt-14">
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHeading
            eyebrow="Book this week"
            title="Providers ready to help"
            lede={
              providerCount
                ? `${providerCount.toLocaleString()}+ licensed providers across New York. Book a Liminal provider now, or browse the full directory.`
                : "Book a Liminal provider now, or browse the full directory of New York providers."
            }
          />
        </div>
        <div className="mt-10">
          <ProviderSpotlightRail providers={spotlightProviders} />
        </div>
        <div className="mx-auto mt-6 w-full max-w-6xl px-6">
          <Link href={browseHref} className="group inline-flex items-center gap-1 text-[15px] font-semibold text-primary">
            <span className="link-wipe">Browse all New York {topic.label.toLowerCase()} providers</span>
            <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </section>

      {/* Trust strip — section 3, on the warm-paper ground like the rest. */}
      <InsurerStrip ground="page" />

      {/* What care looks like here */}
      <Section ground="page">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="max-w-md">
            <SectionHeading title="What care looks like here" lede={topic.intro} />
            <div className="mt-6 flex flex-wrap gap-2">
              {topic.careOffered.map((c) => (
                <Badge key={c} variant="info">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
          <ul className="space-y-4">
            {topic.looksLike.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <Icon name="check" size={20} className="mt-0.5 shrink-0 text-primary" />
                <span className="text-[17px] leading-relaxed text-text-body">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Cost & insurance */}
      <Section ground="page">
        <div className="max-w-2xl">
          <SectionHeading
            title="See your cost before you book."
            lede="Filter to who's in-network with your plan and you'll see your expected cost up front — no surprise bill after the session."
          />
          <p className="mt-5 text-sm text-text-muted">
            Average out-of-pocket per session: <Placeholder token="{{STAT:avg_session_cost}}" />
          </p>
        </div>
      </Section>

      {/* First visit */}
      <Section ground="page">
        <div className="max-w-3xl">
          <SectionHeading eyebrow="Your first visit" title="What the first appointment is like" />
          <p className="mt-5 text-pretty text-lg leading-relaxed text-text-body">{topic.firstVisit}</p>
        </div>
      </Section>

      {/* FAQ */}
      <Section ground="page">
        <SectionHeading title="Questions people ask first" />
        <FaqList items={HOME_FAQS} />
      </Section>

      <CtaBand
        title="Take the first step this week."
        lede="Search by specialty, borough, and coverage — and book when you're ready."
        ground="page"
        primary={{ href: BOOK_HREF, label: "Book a session" }}
        secondary={{ href: browseHref, label: "Browse providers" }}
      />
    </>
  );
}

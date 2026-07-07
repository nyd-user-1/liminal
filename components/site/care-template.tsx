import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "./page-hero";
import { Section, SectionHeading } from "./section";
import { ProviderStrip } from "./provider-card";
import { InsurerStrip } from "./insurer-strip";
import { FaqList } from "./faq";
import { CtaBand } from "./cta-band";
import { Placeholder } from "./placeholder";
import { PLACEHOLDER_PRACTITIONERS, HOME_FAQS, BOOK_HREF, type Topic } from "@/lib/site-content";

// Shared template for every /care/[topic] page — condition and care-type alike.
// Section order per the brief: first-person hero → what care looks like →
// matching providers → cost/insurance → first-visit → FAQ → CTA. Reuses the
// homepage building blocks; invents nothing new. NEW (public marketing site).

function matchedProviders(topic: Topic) {
  const wants = new Set(topic.careOffered);
  const list = PLACEHOLDER_PRACTITIONERS.filter((p) =>
    p.care === "Therapy" ? wants.has("Therapy") : p.care === "Medication" ? wants.has("Medication") : true,
  );
  return (list.length ? list : PLACEHOLDER_PRACTITIONERS).slice(0, 3);
}

export function CareTemplate({ topic, providerCount }: { topic: Topic; providerCount?: number }) {
  const providers = matchedProviders(topic);
  const browseHref = `/find-care?q=${encodeURIComponent(topic.matchQuery)}`;

  return (
    <>
      <PageHero
        eyebrow={topic.eyebrow}
        title={topic.firstPerson}
        lede={topic.lede}
        primary={{ href: BOOK_HREF, label: "Book a session" }}
        secondary={{ href: browseHref, label: "Browse providers" }}
      />

      {/* What care looks like here */}
      <Section>
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

      {/* Matching providers — placeholder bookable strip + real directory link */}
      <Section ground="canvas">
        <SectionHeading
          eyebrow="Book this week"
          title="Providers ready to help"
          lede={
            providerCount
              ? `${providerCount.toLocaleString()}+ licensed providers across New York. Book a Liminal provider now, or browse the full directory.`
              : "Book a Liminal provider now, or browse the full directory of New York providers."
          }
        />
        <ProviderStrip items={providers} />
        <div className="mt-8">
          <Link href={browseHref} className="group inline-flex items-center gap-1 text-[15px] font-semibold text-primary">
            <span className="link-wipe">Browse all New York {topic.label.toLowerCase()} providers</span>
            <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </Section>

      {/* Cost & insurance */}
      <Section>
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
      <InsurerStrip caption="Filter to in-network before you book." />

      {/* First visit */}
      <Section ground="canvas">
        <div className="max-w-3xl">
          <SectionHeading eyebrow="Your first visit" title="What the first appointment is like" />
          <p className="mt-5 text-pretty text-lg leading-relaxed text-text-body">{topic.firstVisit}</p>
        </div>
      </Section>

      {/* FAQ */}
      <Section>
        <SectionHeading title="Questions people ask first" />
        <FaqList items={HOME_FAQS} />
      </Section>

      <CtaBand
        title="Take the first step this week."
        lede="Search by specialty, borough, and coverage — and book when you're ready."
        ground="canvas"
        primary={{ href: BOOK_HREF, label: "Book a session" }}
        secondary={{ href: browseHref, label: "Browse providers" }}
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";
import { Icon } from "@/components/ui/icons";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { Steps } from "@/components/site/steps";
import { FaqList } from "@/components/site/faq";
import { CtaBand } from "@/components/site/cta-band";
import { Placeholder } from "@/components/site/placeholder";
import { PROVIDER_FAQS } from "@/lib/site-content";

// /for-providers — clinician-facing landing. Here the EHR IS named: Liminal is
// one connected system (scheduling + documentation + billing). Software
// language is allowed on provider pages. NEW (public marketing site).
// (Was /providers — that path now serves the public provider search/results
// page; see app/providers/page.tsx.)

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For providers — run your New York practice on Liminal",
  description:
    "Scheduling, documentation, and billing in one connected system. Be present with your patient, not your paperwork — and a directory that sends you clients.",
};

const MKT = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/marketing";

const PATHS = [
  {
    href: "/for-providers/prescribers",
    kicker: "Psychiatrists & PMHNPs",
    title: "For prescribers",
    body: "Medication-management workflow, caseload model, and compensation built for prescribers.",
    icon: "book-heart" as const,
  },
  {
    href: "/for-providers/therapists",
    kicker: "Counselors & clinical social workers",
    title: "For therapists",
    body: "Documentation relief, a full caseload from the directory, and the therapy-side value.",
    icon: "message" as const,
  },
];

export default function ForProvidersPage() {
  return (
    <>
      <PageHero
        eyebrow="For providers"
        title="Be present with your patient — not your paperwork."
        lede="Liminal is one connected system: scheduling, documentation, and billing in one place. Go home on time. The record works for you, not against you."
        primary={{ href: "/join", label: "Apply to join" }}
        secondary={{ href: "/join?walkthrough=1", label: "Book a walkthrough" }}
        aside={
          <Reveal className="overflow-hidden rounded-card border border-border shadow-card">
            <img
              src={`${MKT}/product-booking.avif`}
              alt="Liminal's online booking — a client choosing a visit type before self-booking a slot."
              width={2880}
              height={1440}
              className="block w-full"
              loading="eager"
            />
          </Reveal>
        }
      />

      {/* Workflow narrative — the arc of a clinical encounter */}
      <Section>
        <SectionHeading
          eyebrow="Connect → Care → Complete"
          title="The whole encounter, in one system."
          lede="From the moment a client books to the moment the claim goes out, it's one connected record — not four tools taped together."
        />
        <Steps
          className="mt-12"
          steps={[
            {
              title: "Connect",
              body: "A calendar that fills itself — clients self-book the slots you open, and reminders go out on their own.",
              icon: "calendar-check",
            },
            {
              title: "Care",
              body: "Secure video visits launch in a click, with an AI scribe drafting the progress note before the hour ends.",
              icon: "video",
            },
            {
              title: "Complete",
              body: "Superbills, insurance claims, and card payments live in one place — statements go out without the paperwork pile.",
              icon: "dollar",
            },
          ]}
        />
      </Section>

      {/* Product proof */}
      <Section ground="canvas">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="text-balance font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
              Billing without the busywork.
            </h3>
            <p className="mt-4 max-w-md text-pretty text-[17px] leading-relaxed text-text-body">
              You see what&apos;s outstanding, paid, and overdue at a glance. Claims and superbills go out in a click — the
              record and the money stay in the same place.
            </p>
            <ul className="mt-6 space-y-2.5 text-[15px] text-text-body">
              {[
                "Claims and superbills in a click",
                "Card payments and payer management",
                "Outstanding vs. paid at a glance",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Icon name="check" size={18} className="mt-0.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <Reveal className="overflow-hidden rounded-card border border-border shadow-card lg:order-first">
            <img
              src={`${MKT}/product-billing.avif`}
              alt="Liminal's billing dashboard — outstanding balance, paid this month, and an invoice list."
              width={2880}
              height={1800}
              className="block w-full"
              loading="lazy"
            />
          </Reveal>
        </div>
      </Section>

      {/* Provider testimonial */}
      <Section>
        <figure className="mx-auto max-w-3xl text-center">
          <blockquote className="text-balance font-display text-[26px] font-semibold leading-[1.3] tracking-tight text-text sm:text-[32px]">
            <Placeholder token="{{TESTIMONIAL}}" />
          </blockquote>
          <figcaption className="mt-6 text-[15px] text-text-muted">
            — <Placeholder token="{{TESTIMONIAL_NAME}}" />, provider on Liminal
          </figcaption>
        </figure>
      </Section>

      {/* Two paths */}
      <Section ground="canvas">
        <SectionHeading title="Two paths, built differently." lede="Prescribers and therapists have different economics and different needs — so they get different pages." />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {PATHS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex flex-col rounded-card border border-border bg-surface p-7 shadow-card transition-shadow hover:shadow-menu"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-field bg-primary-wash text-primary-deep">
                <Icon name={p.icon} size={22} />
              </span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{p.kicker}</p>
              <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-text">{p.title}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-text-body">{p.body}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-[15px] font-semibold text-primary">
                <span className="link-wipe">Explore this path</span>
                <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section>
        <SectionHeading title="Questions providers ask" />
        <FaqList items={PROVIDER_FAQS} />
      </Section>

      <CtaBand
        eyebrow="Grow your practice"
        title="Run your New York practice on Liminal."
        lede="Scheduling, telehealth, AI notes, and billing on one platform — and a directory that sends you clients."
        ground="canvas"
        primary={{ href: "/join", label: "Apply to join" }}
        secondary={{ href: "/join?walkthrough=1", label: "Book a walkthrough" }}
      />
    </>
  );
}

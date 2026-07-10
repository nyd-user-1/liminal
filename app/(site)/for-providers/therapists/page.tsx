import type { Metadata } from "next";
import { Icon } from "@/components/ui/icons";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { Steps } from "@/components/site/steps";
import { StatBand } from "@/components/site/stat-band";
import { FaqList } from "@/components/site/faq";
import { CtaBand } from "@/components/site/cta-band";
import { Placeholder } from "@/components/site/placeholder";
import { PROVIDER_FAQS } from "@/lib/site-content";

// /for-providers/therapists — counselors & clinical social workers. Distinct
// economics and language from the prescriber path. Software/EHR language
// allowed. NEW (public marketing site).

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For therapists — build your practice on Liminal",
  description:
    "For counselors and clinical social workers: a caseload that fills from the directory, documentation relief, and the therapy-side value — minus the busywork.",
};

export default function TherapistsPage() {
  return (
    <>
      <PageHero
        eyebrow="For therapists · Counselors & clinical social workers"
        title="Fill your caseload. Lose the busywork."
        lede="Clients find you through the directory and self-book the slots you open. The AI scribe drafts your progress notes. You spend your hours on the work you trained for."
        primary={{ href: "/join?role=therapist", label: "Apply as a therapist" }}
        secondary={{ href: "/join?walkthrough=1", label: "Book a walkthrough" }}
      />

      {/* Economics — therapist-specific */}
      <Section>
        <SectionHeading
          eyebrow="The economics"
          title="A full caseload, on your terms."
          lede="Set your availability and specialties; the directory sends you clients who fit — and no-show protection keeps your hours whole."
        />
        <StatBand
          className="mt-12"
          stats={[
            { value: <Placeholder token="{{STAT:therapist_take_home}}" />, label: "Average take-home per session" },
            { value: <Placeholder token="{{STAT:therapist_caseload}}" />, label: "Typical weekly caseload" },
            { value: <Placeholder token="{{STAT:therapist_noshow}}" />, label: "No-show protection" },
          ]}
        />
      </Section>

      {/* Workflow */}
      <Section ground="canvas">
        <SectionHeading title="Documentation that keeps up with you." />
        <Steps
          className="mt-12"
          steps={[
            {
              title: "Clients self-book",
              body: "Your directory profile takes booking requests for the slots you open — no phone tag, no intake backlog.",
              icon: "calendar-check",
            },
            {
              title: "Meet & document",
              body: "Secure video in a click, and an AI scribe drafts the SOAP or DAP note before the session ends.",
              icon: "video",
            },
            {
              title: "Get paid cleanly",
              body: "Superbills and claims go out from the same record — you see what's outstanding and paid at a glance.",
              icon: "dollar",
            },
          ]}
        />
      </Section>

      {/* Value */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="max-w-md">
            <SectionHeading title="The therapy-side value." lede="Everything is shaped around the way therapists actually work — the standing hour, the ongoing relationship, the notes that have to be right." />
          </div>
          <ul className="space-y-4">
            {[
              "SOAP, DAP, and progress-note templates with an AI first draft",
              "A steady caseload from Liminal's public directory",
              "Secure client messaging and shared documents",
              "Coordination with a prescriber on shared cases",
            ].map((f) => (
              <li key={f} className="flex items-start gap-3">
                <Icon name="check" size={20} className="mt-0.5 shrink-0 text-primary" />
                <span className="text-[17px] leading-relaxed text-text-body">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section ground="canvas">
        <SectionHeading title="Questions therapists ask" />
        <FaqList items={PROVIDER_FAQS} />
      </Section>

      <CtaBand
        title="Grow your practice on Liminal."
        lede="Apply as a therapist, or book a walkthrough to see the documentation and booking flow end to end."
        primary={{ href: "/join?role=therapist", label: "Apply as a therapist" }}
        secondary={{ href: "/join?walkthrough=1", label: "Book a walkthrough" }}
      />
    </>
  );
}

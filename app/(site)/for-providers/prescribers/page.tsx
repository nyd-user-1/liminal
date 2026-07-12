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

// /for-providers/prescribers — psychiatrists & PMHNPs. Distinct economics and
// language from the therapist path. Software/EHR language allowed. NEW.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For prescribers — psychiatry on Leuk",
  description:
    "For psychiatrists and PMHNPs: a medication-management workflow, a caseload that fills itself, and compensation built for prescribers.",
};

export default function PrescribersPage() {
  return (
    <>
      <PageHero
        eyebrow="For prescribers · Psychiatrists & PMHNPs"
        title="Prescribe with support — not overhead."
        lede="A medication-management workflow that keeps the clinical work in front and the admin behind it. E-prescribing, structured follow-ups, and a panel that fills from the directory."
        primary={{ href: "/join?role=prescriber", label: "Apply to prescribe" }}
        secondary={{ href: "/join?walkthrough=1", label: "Book a walkthrough" }}
      />

      {/* Economics — prescriber-specific */}
      <Section>
        <SectionHeading
          eyebrow="The economics"
          title="Built around a prescriber's caseload."
          lede="Compensation and panel size are set for medication management, not stretched from a therapy model."
        />
        <StatBand
          className="mt-12"
          stats={[
            { value: <Placeholder token="{{STAT:prescriber_comp}}" />, label: "Average compensation per visit" },
            { value: <Placeholder token="{{STAT:prescriber_panel}}" />, label: "Active panel size" },
            { value: <Placeholder token="{{STAT:prescriber_followup}}" />, label: "Follow-up cadence" },
          ]}
        />
      </Section>

      {/* Workflow */}
      <Section ground="canvas">
        <SectionHeading title="A medication-management workflow that holds together." />
        <Steps
          className="mt-12"
          steps={[
            {
              title: "Structured intake",
              body: "A full psychiatric evaluation template, with history and screeners captured before the visit.",
              icon: "clipboard",
            },
            {
              title: "Prescribe & order",
              body: "E-prescribing and labs from the same record, with the AI scribe drafting the note as you go.",
              icon: "note",
            },
            {
              title: "Follow up on cadence",
              body: "Recurring med-check visits self-book on schedule, so continuity happens without chasing it.",
              icon: "calendar-check",
            },
          ]}
        />
      </Section>

      {/* Value */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="max-w-md">
            <SectionHeading title="Collaboration when you want it." lede="Supervision and collaborative-care arrangements are supported where they apply — so PMHNPs and psychiatrists can work the way their license and state require." />
          </div>
          <ul className="space-y-4">
            {[
              "E-prescribing and controlled-substance workflows in the record",
              "Coordination with the client's therapist on shared cases",
              "Panel that fills from Leuk's public directory",
              "Structured follow-up so no one falls through the cracks",
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
        <SectionHeading title="Questions prescribers ask" />
        <FaqList items={PROVIDER_FAQS} />
      </Section>

      <CtaBand
        title="Bring your panel to Leuk."
        lede="Apply to prescribe, or book a walkthrough to see the medication-management workflow end to end."
        primary={{ href: "/join?role=prescriber", label: "Apply to prescribe" }}
        secondary={{ href: "/join?walkthrough=1", label: "Book a walkthrough" }}
      />
    </>
  );
}

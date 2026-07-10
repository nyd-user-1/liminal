import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Nav } from "@/components/marketing/nav";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { FeatureGrid } from "@/components/site/feature-grid";
import { StatBand } from "@/components/site/stat-band";
import { CtaBand } from "@/components/site/cta-band";
import { Placeholder } from "@/components/site/placeholder";

// /company/about — company story + values. NEW.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About us · Liminal",
  description:
    "Liminal is a directory of licensed New York mental-health providers, and the practice-management system they run on — built so finding real, covered care doesn't take weeks.",
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />
      <main className="flex-1">
        <PageHero
          eyebrow="About Liminal"
          title="Care shouldn't be this hard to find."
          lede="Liminal started from a simple frustration: New Yorkers looking for a therapist or psychiatrist spend weeks on hold, calling offices that never call back, before they even learn who takes their insurance. We built the directory we wished existed — and the practice software behind it, so the providers on the other end can actually keep up."
          primary={{ href: "/providers", label: "Find a provider" }}
          secondary={{ href: "/join", label: "For providers" }}
        />

        <Section>
          <SectionHeading eyebrow="What we believe" title="Three things we don't compromise on." />
          <FeatureGrid
            className="mt-12"
            columns={3}
            items={[
              {
                icon: "heart-handshake",
                title: "Patient-first, always",
                body: "The fastest path to a booked, in-network appointment is the whole product. Everything else is in service of that.",
              },
              {
                icon: "shield-plus",
                title: "Credibility over hype",
                body: "This is healthcare, not a wellness app. Every provider is licensed and verified before they appear in the directory.",
              },
              {
                icon: "map-pin",
                title: "Built for New York",
                body: "Not a national template — coverage, boroughs, counties, and the insurance plans people actually carry here.",
              },
            ]}
          />
        </Section>

        <Section ground="canvas">
          <SectionHeading eyebrow="By the numbers" title="A directory big enough to be useful." />
          <StatBand
            className="mt-12"
            stats={[
              { value: "116,000+", label: "Licensed NY providers in the directory" },
              { value: <Placeholder token="{{STAT:about_avg_time_to_book}}" />, label: "Median time to a booked appointment" },
              { value: <Placeholder token="{{STAT:about_counties}}" />, label: "New York counties covered" },
            ]}
          />
        </Section>

        <CtaBand
          title="Find care, or bring your practice to Liminal."
          lede="One system for the person looking for help, and the provider ready to see them."
          primary={{ href: "/providers", label: "Find a provider" }}
          secondary={{ href: "/join", label: "Join as a provider" }}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { StatBand } from "@/components/site/stat-band";
import { CtaBand } from "@/components/site/cta-band";
import { InsurerStrip } from "@/components/site/insurer-strip";
import { Placeholder } from "@/components/site/placeholder";
import { PayerSpreadTable } from "@/components/site/payer-spread-table";
import { RateIntelFamily } from "@/components/site/rate-intel-family";
import { getCorpusStats, get90837Spread, formatCompact } from "@/lib/repos/public-stats";

// /pricing-data — the corpus page. Payer transparency data reveals what every
// plan actually pays; where others show one illustrative example, we show the
// live corpus. Audience: NY behavioral clinicians and practice owners. Every
// number is fetched live (lib/repos/public-stats) and dated. NEW (public
// marketing site) — rate-intelligence family.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rate data — what every payer actually pays | Leuk",
  description:
    "Millions of payer-published in-network rates across New York, refreshed nightly. See the market median for a session, by payer — the data behind the answer.",
};

// "13.6M+" for estimate-backed counts, or a visible placeholder when a read is
// unavailable (offline dev / a not-yet-built table). Never a hardcoded number.
function plus(n: number | null, token: string): ReactNode {
  return n != null ? `${formatCompact(n)}+` : <Placeholder token={token} />;
}
function exact(n: number | null, token: string): ReactNode {
  return n != null ? formatCompact(n) : <Placeholder token={token} />;
}

export default async function PricingDataPage() {
  const [stats, spread] = await Promise.all([getCorpusStats(), get90837Spread()]);
  const payerCount = spread.rows.length;

  return (
    <>
      <PageHero
        eyebrow="Rate intelligence"
        title="Know what every payer actually pays."
        lede="Payers publish their in-network rates. We hold millions of them across New York, resolved to real insurers and networks and refreshed nightly — so a rate stops being a mystery and starts being evidence."
        primary={{ href: "/join", label: "Bring your practice onto Leuk" }}
        secondary={{ href: "/providers", label: "Browse the directory" }}
      />

      {/* Corpus scale — the credibility is the count. */}
      <Section ground="canvas">
        <SectionHeading
          eyebrow="What's behind the answer"
          title="Not a sample. The corpus."
          lede="Consulting decks show you one illustrative rate. This is the live inventory underneath the answer — every figure fetched at the moment you load this page."
        />
        <StatBand
          className="mt-14"
          stats={[
            {
              value: plus(stats.attestedRates, "{{STAT:attested_rates}}"),
              label: "Payer-attested in-network rates on file",
              note: "From payer MRF / Transparency-in-Coverage files",
            },
            {
              value: plus(stats.clinicians, "{{STAT:clinicians}}"),
              label: "New York behavioral clinicians in the directory",
              note: "NPPES + New York Medicaid",
            },
            {
              value: plus(stats.billingOrgs, "{{STAT:billing_orgs}}"),
              label: "Billing organizations resolved",
              note: "Mapped from published rate files",
            },
            {
              value: exact(stats.insurers, "{{STAT:insurers}}"),
              label: "Canonical insurers",
              note: "Resolved from the NY DFS registry",
            },
            {
              value: exact(stats.networks, "{{STAT:networks}}"),
              label: "Canonical networks",
              note: "Deduplicated, administrator-aware",
            },
            {
              value: plus(stats.planFilings, "{{STAT:plan_filings}}"),
              label: "Federal plan filings",
              note: "DOL Form 5500 registry",
            },
          ]}
        />
      </Section>

      {/* The real benchmark moment — one session, thirteen prices. */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="A real benchmark"
              title={
                payerCount > 0 ? (
                  <>
                    The same session, <span className="text-primary-deep">{payerCount} prices.</span>
                  </>
                ) : (
                  "The same session, many prices."
                )
              }
              lede="One CPT code — a 60-minute individual psychotherapy session — priced across New York's behavioral books. This is the payer's own published in-network median, side by side. The spread is not an opinion; it's what they filed."
            />
            <p className="mt-6 text-[15px] leading-relaxed text-text-body">
              Read left to right, the difference between the top book and the bottom is the difference between a
              sustainable panel and one you quietly drop. Most clinicians have never seen this table for their own
              codes.
            </p>
          </div>
          <PayerSpreadTable spread={spread} />
        </div>
      </Section>

      {/* How the data gets here — one quiet, confident section. */}
      <Section ground="canvas">
        <SectionHeading
          eyebrow="How the data gets here"
          title="Published by the payer. Cleaned by us."
          lede="Nothing here is scraped from a claim or guessed from a model. It is the payer's own attestation, resolved to a real entity and kept current."
          align="center"
        />
        <ol className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-3">
          {[
            {
              icon: "file-up" as const,
              title: "Payers file it",
              body: "Federal price-transparency rules require every plan to publish its in-network rates. Those machine-readable files are the source — the payer's own number, on the record.",
            },
            {
              icon: "wand-sparkles" as const,
              title: "We resolve it",
              body: "Raw files name entities inconsistently. We map each one to a canonical insurer and network from the NY regulator's registry, so a rate belongs to a payer you'd recognize.",
            },
            {
              icon: "refresh-cw" as const,
              title: "Refreshed nightly",
              body: "Rates drift as contracts change and new files land. An overnight job re-reads and re-aggregates, so the median you see is the current one — carrying the date it's good as of.",
            },
          ].map((s, i) => (
            <li key={s.title}>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-wash font-display text-lg font-bold text-primary-deep">
                  {i + 1}
                </span>
                <Icon name={s.icon} size={20} className="text-primary" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-text">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-text-body">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <InsurerStrip ground="page" caption="Rates resolved to the plans New Yorkers actually carry." />

      <CtaBand
        eyebrow="Put it to work"
        title="See where your rates sit."
        lede="Clinicians and practices on Leuk see their own payer mix beside the market — the same corpus, pointed at your codes."
        ground="surface"
        primary={{ href: "/join", label: "Bring your practice onto Leuk" }}
        secondary={{ href: "/for-providers", label: "For providers" }}
      />

      <RateIntelFamily current="pricing-data" />
    </>
  );
}

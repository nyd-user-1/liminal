import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";
import { Section, SectionHeading } from "./section";

// The rate-intelligence family cross-link band — the quiet "these three pages
// are one argument" row at the foot of each page. NEW (public marketing site):
// a composition of Section + Icon + tokens, shared by all three pages so the
// family stays in lockstep (add a page here once, not in three places). The
// current page renders as a non-link "You're here" tile; the siblings link out.

type FamilyKey = "pricing-data" | "payer-negotiation" | "payer-disputes";

const FAMILY: Array<{ key: FamilyKey; href: string; kicker: string; title: string; body: string; icon: IconName }> = [
  {
    key: "pricing-data",
    href: "/pricing-data",
    kicker: "Know your rates",
    title: "The rate corpus",
    body: "The live data itself — millions of payer-published in-network rates across New York, dated.",
    icon: "activity",
  },
  {
    key: "payer-negotiation",
    href: "/payer-negotiation",
    kicker: "Negotiate from evidence",
    title: "Payer negotiation",
    body: "Your payer mix beside the market median — the number you can't argue without seeing.",
    icon: "dollar",
  },
  {
    key: "payer-disputes",
    href: "/payer-disputes",
    kicker: "Dispute with receipts",
    title: "Underpayment disputes",
    body: "The strongest evidence in a dispute is the payer's own published attestation.",
    icon: "file-text",
  },
];

export function RateIntelFamily({ current }: { current: FamilyKey }) {
  return (
    <Section ground="page">
      <SectionHeading
        eyebrow="One argument, three moves"
        title="Know your rates. Negotiate from evidence. Dispute with receipts."
        lede="Every number on these pages is the payer's own published attestation — the same corpus, seen three ways."
      />
      <ul className="mt-12 grid gap-6 sm:grid-cols-3">
        {FAMILY.map((f) => {
          const here = f.key === current;
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-field ${
                    here ? "bg-primary text-white" : "bg-primary-wash text-primary-deep"
                  }`}
                >
                  <Icon name={f.icon} size={22} />
                </span>
                {here ? (
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">You&rsquo;re here</span>
                ) : (
                  <span aria-hidden className="text-text-muted transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                )}
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{f.kicker}</p>
              <h3 className="mt-1.5 font-display text-xl font-semibold text-text">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-text-body">{f.body}</p>
            </>
          );
          return (
            <li key={f.key} className="h-full">
              {here ? (
                <div className="flex h-full flex-col rounded-card border border-primary-weak bg-surface p-6 shadow-card">
                  {inner}
                </div>
              ) : (
                <Link
                  href={f.href}
                  className="group flex h-full flex-col rounded-card border border-border bg-surface p-6 shadow-card transition-shadow hover:shadow-menu"
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

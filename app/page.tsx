import { CtaButton } from "@/components/marketing/cta-button";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Icon, type IconName } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

// Public marketing front door (Headway pattern, re-skinned Liminal). Rendered
// for everyone — signed-in users still land here; the portal links route them
// by role through /sign-in.

const VALUE = [
  {
    icon: "calendar" as IconName,
    title: "Scheduling that fills itself",
    body: "Online booking, reminders, and a calendar your whole practice shares. Clients self-book in the slots you open.",
  },
  {
    icon: "video" as IconName,
    title: "Telehealth + AI notes",
    body: "Secure video visits with an AI scribe that drafts your progress notes, so you finish charting before the hour ends.",
  },
  {
    icon: "dollar" as IconName,
    title: "Billing without the busywork",
    body: "Superbills, insurance, and card payments in one place. Claims and statements go out without the paperwork pile.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <MarketingNav />

      {/* Hero */}
      <section className="bg-sidebar-bg">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center sm:py-32">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Find mental-health care in New York — and the practice tools to deliver it.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-sidebar-text/85">
            Search 8,500+ licensed providers and 6,400+ programs across the five boroughs, then book care that fits
            your life.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaButton href="/find-care" size="xl">
              Find care
            </CtaButton>
            <CtaButton href="/join" size="xl" variant="secondary">
              Join as a provider
            </CtaButton>
          </div>
        </div>
      </section>

      {/* Value sections */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-3">
          {VALUE.map((v) => (
            <div key={v.title} className="flex flex-col gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-card bg-teal-100 text-primary">
                <Icon name={v.icon} size={22} />
              </span>
              <h2 className="text-lg font-semibold text-text">{v.title}</h2>
              <p className="text-text-body">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t border-border bg-canvas">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-text">Ready to get started?</h2>
          <p className="max-w-md text-text-body">
            Book with a Liminal clinician, or search the full New York provider directory.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <CtaButton href="/book/liminal">Book an appointment</CtaButton>
            <CtaButton href="/find-care" variant="secondary">
              Browse the directory
            </CtaButton>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

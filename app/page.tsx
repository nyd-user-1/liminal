import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { CtaButton } from "@/components/marketing/cta-button";
import { HeroSearch } from "@/components/marketing/hero-search";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Nav } from "@/components/marketing/nav";

export const dynamic = "force-dynamic";

// Home. Art direction: "New York care index" — deep-navy field, amber as the
// committed accent (not the calm-teal category reflex), Bricolage Grotesque
// display against Inter body, and the real product as the imagery. No section
// eyebrows, no icon-tile card grid, no hero-metric card.

const INK = "#101528"; // deep near-black navy for the dark fields

const SPECIALTIES: Array<{ name: string; note: string; q: string }> = [
  { name: "Anxiety & depression", note: "The most-searched reason to reach out", q: "Anxiety and Depression" },
  { name: "Trauma & PTSD", note: "EMDR, CPT, trauma-informed clinicians", q: "Trauma and PTSD" },
  { name: "ADHD", note: "Evaluation, coaching, and medication", q: "ADHD" },
  { name: "Couples & family", note: "Relationships and family dynamics", q: "Couples" },
  { name: "Grief & loss", note: "Bereavement and major life change", q: "Grief and Loss" },
  { name: "LGBTQIA+ affirming", note: "Care that centers who you are", q: "LGBTQIA+" },
  { name: "Bipolar disorder", note: "Diagnosis and ongoing management", q: "Bipolar Disorder" },
  { name: "OCD", note: "ERP and specialist clinicians", q: "OCD" },
];

const PLANS = [
  "Aetna",
  "Cigna",
  "UnitedHealthcare",
  "Oxford",
  "Empire BlueCross",
  "Fidelis Care",
  "Healthfirst",
  "EmblemHealth",
  "MetroPlus",
  "Oscar",
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Nav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary-wash lg:flex lg:min-h-[calc(100svh-72px)] lg:items-center">
        {/* real product — larger, bleeding ~20% off the right edge on desktop */}
        <div
          className="pointer-events-none absolute top-1/2 z-0 hidden w-[54vw] -translate-y-1/2 lg:block"
          style={{ right: "-11vw" }}
        >
          <div className="overflow-hidden rounded-[16px] border border-primary/15 bg-white shadow-[0_44px_90px_-34px_rgba(28,36,64,0.30)]">
            <img
              src="/marketing/product-calendar.png"
              alt="A practitioner's weekly calendar in Liminal — colour-coded telehealth and in-person sessions, with the day's agenda alongside."
              width={2880}
              height={1800}
              className="block w-full"
              loading="eager"
            />
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 sm:py-20 lg:py-16">
          <div className="lg:max-w-[54%]">
            <h1
              className="mkt-rise text-balance font-display font-extrabold tracking-[-0.03em] text-text"
              style={{ fontSize: "clamp(2.75rem, 6vw, 5.25rem)", lineHeight: 1.01 }}
            >
              Healing belongs to{" "}
              <span className="text-primary">everyone.</span>
            </h1>
            <p className="mkt-rise mkt-d1 mt-6 max-w-xl text-pretty text-lg text-text-body sm:text-xl">
              We meet you where you are.
            </p>
            <div className="mkt-rise mkt-d2 mt-8 max-w-xl">
              <HeroSearch />
            </div>
            <p className="mkt-rise mkt-d3 mt-5 max-w-xl text-sm text-text-muted">
              *Search more than 116,000+ mental health providers instantly. No sign up required.
            </p>
          </div>

          {/* mobile product shot */}
          <div className="mkt-fade mt-10 lg:hidden">
            <div className="overflow-hidden rounded-[14px] border border-primary/15 bg-white shadow-[0_30px_60px_-30px_rgba(28,36,64,0.25)]">
              <img
                src="/marketing/product-calendar.png"
                alt="A practitioner's weekly calendar in Liminal."
                width={2880}
                height={1800}
                className="block w-full"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Directory index ──────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="max-w-xl text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            What are you walking through?
          </h2>
          <Link
            href="/find-care"
            className="text-[15px] font-semibold text-primary underline-offset-4 hover:underline"
          >
            Browse the full directory →
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 md:gap-x-14">
          {SPECIALTIES.map((s) => (
            <Link
              key={s.name}
              href={`/find-care?q=${encodeURIComponent(s.q)}`}
              className="group flex items-baseline justify-between gap-6 border-b border-border py-5 transition-colors"
            >
              <span className="min-w-0">
                <span className="font-display text-xl font-semibold text-text transition-colors group-hover:text-accent-ink sm:text-2xl">
                  {s.name}
                </span>
                <span className="mt-0.5 block truncate text-sm text-text-muted">{s.note}</span>
              </span>
              <span
                aria-hidden
                className="shrink-0 translate-x-0 text-lg text-text-muted transition-all group-hover:translate-x-1 group-hover:text-accent-ink"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Threshold band (full-bleed) ──────────────────────────────────── */}
      <section className="relative w-full overflow-hidden">
        <img
          src="https://peudpngwdxsymrzx.public.blob.vercel-storage.com/assets/liminal-1a.avif"
          alt="An open wooden door standing alone in a sunlit, mist-softened meadow, a footpath leading through it."
          width={1312}
          height={816}
          className="h-[clamp(360px,52vh,560px)] w-full object-cover"
          loading="lazy"
        />
        {/* legibility scrim over the image's built-in left text gutter */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/75 via-white/15 to-transparent" />
        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-6xl items-center px-6">
            <div className="max-w-md">
              <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-[40px]">
                The door is already open.
              </h2>
              <p className="mt-3 text-pretty text-lg text-text-body">
                Whatever you&apos;re walking through, you don&apos;t have to do it alone.
              </p>
              <Link
                href="/find-care"
                className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-primary underline-offset-4 hover:underline"
              >
                Find your provider →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Product showcase (real screenshots) ──────────────────────────── */}
      <section id="for-providers" className="scroll-mt-20 bg-canvas">
        <div className="mx-auto max-w-6xl space-y-20 px-6 py-20 sm:space-y-28 sm:py-28">
          {/* calendar */}
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-[38px]">
                A calendar that fills itself.
              </h2>
              <p className="mt-4 max-w-md text-pretty text-lg text-text-body">
                Clients self-book the slots you open. Reminders go out on their own. Telehealth visits launch in a click,
                with an AI scribe drafting the note before the hour ends.
              </p>
              <ul className="mt-6 space-y-2.5 text-[15px] text-text-body">
                {["Shared, colour-coded practice calendar", "Same-week online booking", "Secure video + AI progress notes"].map(
                  (f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Icon name="check" size={18} className="mt-0.5 shrink-0 text-primary" />
                      {f}
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div className="overflow-hidden rounded-[12px] border border-border shadow-[0_28px_60px_-28px_rgba(16,21,40,0.4)] lg:-mr-10">
              <img
                src="/marketing/product-booking.png"
                alt="Liminal's online booking — a client choosing a visit type before self-booking a slot."
                width={2880}
                height={1440}
                className="block w-full"
                loading="lazy"
              />
            </div>
          </div>

          {/* billing */}
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="overflow-hidden rounded-[12px] border border-border shadow-[0_28px_60px_-28px_rgba(16,21,40,0.4)] lg:order-1 lg:-ml-10">
              <img
                src="/marketing/product-billing.png"
                alt="Liminal's billing dashboard — outstanding balance, paid this month, and an invoice list."
                width={2880}
                height={1800}
                className="block w-full"
                loading="lazy"
              />
            </div>
            <div className="lg:order-2">
              <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-[38px]">
                Billing without the busywork.
              </h2>
              <p className="mt-4 max-w-md text-pretty text-lg text-text-body">
                Superbills, insurance claims, and card payments live in one place. You see what&apos;s outstanding, paid,
                and overdue at a glance — statements go out without the paperwork pile.
              </p>
              <ul className="mt-6 space-y-2.5 text-[15px] text-text-body">
                {["Claims and superbills in a click", "Card payments and payer management", "Outstanding vs. paid at a glance"].map(
                  (f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Icon name="check" size={18} className="mt-0.5 shrink-0 text-primary" />
                      {f}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Coverage ─────────────────────────────────────────────────────── */}
      <section className="text-white" style={{ backgroundColor: INK }}>
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-16 md:grid-cols-2 md:gap-16">
          <div>
            <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Covered by New York&apos;s major plans.
            </h2>
            <p className="mt-3 max-w-md text-pretty text-white/70">
              Filter to who&apos;s in-network before you book, so you know your cost up front — no surprise bill after the
              session.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-3 text-white/80 sm:text-lg">
            {PLANS.map((p) => (
              <li key={p} className="border-b border-white/10 pb-3 font-display font-medium">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Pull quote ───────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-4xl px-6 py-20 sm:py-24">
        <blockquote className="text-balance font-display text-3xl font-semibold leading-[1.25] tracking-tight text-text sm:text-4xl">
          <span className="text-accent-ink">&ldquo;</span>
          I filtered to Brooklyn, teletherapy, and my insurance — and booked a first session for the same week. No phone
          tag, no waitlist.
          <span className="text-accent-ink">&rdquo;</span>
        </blockquote>
        <figcaption className="mt-6 text-[15px] text-text-muted">Dana R. — client in Brooklyn</figcaption>
      </section>

      {/* ── Provider CTA (amber drench) ──────────────────────────────────── */}
      <section style={{ backgroundColor: "#F0AE55", color: INK }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-balance font-display text-3xl font-bold tracking-tight sm:text-[40px]" style={{ color: INK }}>
              Run your New York practice on Liminal.
            </h2>
            <p className="mt-3 max-w-xl text-pretty text-[17px]" style={{ color: "rgba(16,21,40,0.75)" }}>
              Scheduling, telehealth, AI notes, and billing on one platform — and a directory that sends you clients.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link
              href="/join"
              className="inline-flex h-12 items-center justify-center rounded-field px-6 text-[15px] font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: INK }}
            >
              Join as a provider
            </Link>
            <Link
              href="/#for-providers"
              className="inline-flex h-12 items-center justify-center rounded-field border px-6 text-[15px] font-semibold transition-colors hover:bg-black/5"
              style={{ borderColor: "rgba(16,21,40,0.35)", color: INK }}
            >
              See the tools
            </Link>
          </div>
        </div>
      </section>

      {/* ── Closing search ───────────────────────────────────────────────── */}
      <section className="bg-surface">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
          <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Find care without the guesswork.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-pretty text-lg text-text-body">
            Search by specialty, borough, and coverage — all in one place.
          </p>
          <div className="mx-auto mt-8 max-w-xl text-left">
            <HeroSearch />
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { HeroSearch } from "@/components/marketing/hero-search";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Nav } from "@/components/marketing/nav";
import { Reveal } from "@/components/marketing/reveal";

export const dynamic = "force-dynamic";

// Home. The whole page is one sheet of watercolour paper: every painting is
// feathered (.mkt-paint) so its own paper edge dissolves into the `--color-paper`
// ground instead of reading as a boxed rectangle, and scenes are scaled up and
// alternated left/right rather than stamped into identical 50/50 rows. Warmth is
// carried by the imagery; type stays disciplined (Bricolage display / Inter body);
// the one dark note is the dusk painting bleeding into the navy footer. Hero is LOCKED.

// Paintings are served from /public after being reprinted onto the paper ground
// (see scripts note): each source AVIF is transformed pixel×ground÷paper so its
// own paper dissolves into `--color-paper`, then feathered (.mkt-paint) to erase
// any residual edge. Logos + product screenshots stay on the blob CDN.
const ILLO = "/illustrations";
// Background-removed (transparent) paintings — these float on the paper ground
// with no box, no bake, no feather. nightstand + morning-path have no cutout yet,
// so they stay on the reprinted /illustrations versions.
const CUT = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/cut";
const LOGO = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/logos/insurance";
const SHOT = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/marketing";

// The full set of watercolour moments, shown as a floating collage.
const GALLERY: Array<{ slug: string; alt: string }> = [
  { slug: "lakeside", alt: "a person wrapped in a shawl sits on a bench by a still lake at dawn, holding a mug" },
  { slug: "walking-together", alt: "two people walk a small dog along a stream at golden hour" },
  { slug: "one-thing", alt: "a mug, an open journal reading “one thing at a time”, and a laptop in morning light" },
  { slug: "video-visit", alt: "a man at his kitchen table on a video visit with his provider" },
  { slug: "resting-meadow", alt: "a person lies back in tall grass, hands behind their head, at ease" },
  { slug: "gathering", alt: "three friends laughing around a table over a board game" },
  { slug: "hillside-dusk", alt: "a small figure sits in a meadow looking out over hills at dusk" },
  { slug: "telehealth", alt: "a person settled in an armchair on a video visit, a plant beside them" },
  { slug: "proud-of-you", alt: "a steaming mug, a handwritten “proud of you” card, and a sprig in a small vase" },
  { slug: "grounding", alt: "a person kneels with their hands resting on the earth" },
  { slug: "dusk-lake", alt: "a person sits by a lake beneath a bare tree at dusk" },
  { slug: "tending-seedling", alt: "a person kneels in a garden bed, planting a seedling" },
];

const INSURERS = [
  { slug: "united", name: "UnitedHealthcare" },
  { slug: "aetna", name: "Aetna" },
  { slug: "anthem", name: "Anthem" },
  { slug: "cigna", name: "Cigna" },
  { slug: "carelon", name: "Carelon" },
  { slug: "optum-oscar", name: "Optum" },
];

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
    <div className="flex min-h-screen flex-col bg-paper">
      <Nav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative bg-primary-wash lg:flex lg:min-h-[calc(100svh-72px)] lg:items-center">
        {/* hero illustration — full scene on the mint wash; the cream paper is
            multiplied into the background so image and page read as one surface */}
        <div className="pointer-events-none absolute top-[47%] right-0 z-0 hidden w-[54vw] -translate-y-1/2 lg:block">
          <img
            src="https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/liminal_e0mhvxe0mhvxe0mh-mint.avif"
            alt="A watercolour illustration — a person wrapped in a knit blanket sits on a bench by a still lake at dawn, holding a warm mug."
            width={2816}
            height={1536}
            className="mkt-develop mkt-d2 block w-full"
            loading="eager"
          />
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
              <HeroSearch autoFocus />
            </div>
            <p className="mkt-rise mkt-d3 mt-5 max-w-xl text-sm text-text-body">
              *Search more than 116,000+ mental health providers instantly. No sign up required.
            </p>
          </div>

          {/* mobile illustration — directly on the wash, cream paper multiplied out */}
          <div className="mt-10 lg:hidden">
            <img
              src="https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/liminal_e0mhvxe0mhvxe0mh-mint.avif"
              alt="A watercolour illustration — a person wrapped in a knit blanket sits on a bench by a still lake at dawn, holding a warm mug."
              width={2816}
              height={1536}
              className="mkt-develop block w-full"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* ── Trust — in-network proof, quiet on the paper ─────────────────── */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-6 py-12">
          <p className="text-center text-sm text-text-muted">
            In-network with the plans New Yorkers already carry.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {INSURERS.map((p) => (
              <img
                key={p.slug}
                src={`${LOGO}/${p.slug}.avif`}
                alt={`${p.name} — accepted insurance`}
                className="h-6 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 sm:h-7"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── A · Browse — what are you walking through? (patient) ──────────── */}
      <section className="paper-section">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-xl text-balance font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
              Healing starts in the little moments.
            </h2>
            <Link href="/find-care" className="group shrink-0 text-[15px] font-semibold text-primary">
              <span className="link-wipe">Browse the full directory</span>
              <span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-16">
            <Reveal>
              <img
                src={`${CUT}/walking-together.avif`}
                alt="A watercolour illustration — two people walk a small dog along a stream at golden hour, mid-conversation."
                width={1600}
                height={873}
                className="block w-full"
                loading="lazy"
              />
            </Reveal>

            <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-1">
              {SPECIALTIES.map((s) => (
                <li key={s.name}>
                  <Link
                    href={`/find-care?q=${encodeURIComponent(s.q)}`}
                    className="group flex items-baseline justify-between gap-5 border-b border-paper-edge py-4"
                  >
                    <span className="min-w-0">
                      <span className="font-display text-lg font-semibold text-text transition-colors group-hover:text-primary">
                        {s.name}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-text-muted">{s.note}</span>
                    </span>
                    <span
                      aria-hidden
                      className="shrink-0 text-text-muted transition-all group-hover:translate-x-1 group-hover:text-primary"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── B · Continuity — your story stays with you (patient) ─────────── */}
      <section className="paper-section">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-6 py-24 sm:py-32 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="max-w-md lg:pl-2">
            <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-[40px]">
              Your story stays with you.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-text-body">
              The people who care for you already know it. Every visit picks up where the last one left off — no
              starting over, no repeating the hard parts.
            </p>
            <Link
              href="/find-care"
              className="group mt-7 inline-flex items-center gap-1 text-[15px] font-semibold text-primary"
            >
              <span className="link-wipe">Find care that remembers</span>
              <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
          <Reveal className="lg:order-last">
            <img
              src={`${CUT}/objects6.avif`}
              alt="A watercolour illustration — an entryway shelf by the door: a dish of keys, a folded plaid blanket, a potted succulent, and a pinned handwritten note."
              width={1600}
              height={873}
              className="mkt-paint block w-full"
              loading="lazy"
            />
          </Reveal>
        </div>
      </section>

      {/* ── C · Testimonial — Dana R. (patient) ──────────────────────────── */}
      <section>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-6 py-24 sm:py-32 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <img
              src={`${CUT}/proud-of-you.avif`}
              alt="A watercolour illustration — a still life in morning light: a steaming mug, a handwritten “proud of you” card, and a sprig in a small vase."
              width={1600}
              height={873}
              className="block w-full"
              loading="lazy"
            />
          </Reveal>
          <figure className="lg:pr-6">
            <blockquote className="text-balance font-display text-[28px] font-semibold leading-[1.25] tracking-tight text-text sm:text-[36px]">
              I filtered to Brooklyn, teletherapy, and my insurance — and booked a first session for the same week. No
              phone tag, no waitlist.
            </blockquote>
            <figcaption className="mt-6 text-[15px] text-text-muted">Dana R. — client in Brooklyn</figcaption>
          </figure>
        </div>
      </section>

      {/* ── Gallery — the ordinary moments of a life (patient) ───────────── */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
              Care meets you in the ordinary moments.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-text-body">
              Not the milestones — the small, unremarkable hours where you slowly start to feel like yourself again.
            </p>
          </div>
          <div className="mt-16 gap-x-8 sm:columns-2 lg:columns-3">
            {GALLERY.map((g) => (
              <div key={g.slug} className="mb-8 break-inside-avoid">
                <img
                  src={`${CUT}/${g.slug}.avif`}
                  alt={`A watercolour illustration — ${g.alt}.`}
                  className="block w-full"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── D · Provider band (provider — software language allowed here) ──── */}
      <section id="for-providers" className="scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
          {/* bridge — a full-width breath that signals the audience switch */}
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">For providers</p>
            <h2 className="mt-4 text-balance font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
              Be present with your patient — not your paperwork.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-text-body">
              Scheduling, telehealth, notes, and billing run quietly in the background — so the practice behind the care
              can go home on time.
            </p>
          </div>
          <Reveal className="mx-auto mt-12 max-w-3xl">
            <img
              src={`${CUT}/resting-meadow.avif`}
              alt="A watercolour illustration — a person lies back in tall grass, hands behind their head, eyes closed, at ease."
              width={1024}
              height={559}
              className="block w-full"
              loading="lazy"
            />
          </Reveal>

          {/* calendar */}
          <div className="mt-24 grid items-center gap-10 sm:mt-28 lg:grid-cols-2 lg:gap-16">
            <div>
              <h3 className="text-balance font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
                A calendar that fills itself.
              </h3>
              <p className="mt-4 max-w-md text-pretty text-[17px] leading-relaxed text-text-body">
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
            <Reveal className="overflow-hidden rounded-card border border-border bg-surface">
              <img
                src={`${SHOT}/product-booking.avif`}
                alt="Liminal's online booking — a client choosing a visit type before self-booking a slot."
                width={2880}
                height={1440}
                className="block w-full"
                loading="lazy"
              />
            </Reveal>
          </div>

          {/* billing */}
          <div className="mt-16 grid items-center gap-10 sm:mt-24 lg:grid-cols-2 lg:gap-16">
            <Reveal className="overflow-hidden rounded-card border border-border bg-surface lg:order-1">
              <img
                src={`${SHOT}/product-billing.avif`}
                alt="Liminal's billing dashboard — outstanding balance, paid this month, and an invoice list."
                width={2880}
                height={1800}
                className="block w-full"
                loading="lazy"
              />
            </Reveal>
            <div className="lg:order-2">
              <h3 className="text-balance font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
                Billing without the busywork.
              </h3>
              <p className="mt-4 max-w-md text-pretty text-[17px] leading-relaxed text-text-body">
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

      {/* ── E · Provider CTA — grow your practice (provider) ──────────────── */}
      <section>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-6 py-24 sm:py-32 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-md lg:pl-2">
            <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-[40px]">
              Run your New York practice on Liminal.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-text-body">
              Scheduling, telehealth, AI notes, and billing on one platform — and a directory that sends you clients.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/join"
                className="inline-flex h-12 items-center justify-center rounded-field bg-primary px-6 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                Join as a provider
              </Link>
              <Link
                href="/#for-providers"
                className="inline-flex h-12 items-center justify-center rounded-field border border-field-border px-6 text-[15px] font-semibold text-text transition-colors hover:bg-surface"
              >
                See the tools
              </Link>
            </div>
          </div>
          <Reveal className="lg:order-last">
            <img
              src={`${CUT}/tending-seedling.avif`}
              alt="A watercolour illustration — a person kneels in a garden bed, planting a seedling, a watering can beside them."
              width={1600}
              height={873}
              className="block w-full"
              loading="lazy"
            />
          </Reveal>
        </div>
      </section>

      {/* ── F · Insurance — functional breath (patient) ──────────────────── */}
      <section>
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 md:grid-cols-[1fr_1.15fr] md:gap-16">
          <div className="max-w-sm">
            <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
              Covered by New York&apos;s major plans.
            </h2>
            <p className="mt-4 text-pretty text-text-body">
              Filter to who&apos;s in-network before you book — you&apos;ll see your cost up front, with no surprise bill
              after the session.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-x-10 self-center">
            {PLANS.map((p) => (
              <li key={p} className="border-b border-paper-edge py-3 font-display text-[15px] font-medium text-text">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── G · Closing patient CTA — begin (patient) ────────────────────── */}
      <section>
        <div className="mx-auto max-w-3xl px-6 pt-24 text-center sm:pt-32">
          <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
            Find care without the guesswork.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-lg text-text-body">
            Search by specialty, borough, and coverage — and take the first step this week.
          </p>
        </div>
        <Reveal className="mx-auto mt-8 max-w-5xl px-6">
          <img
            src={`${ILLO}/morning-path.avif`}
            alt="A watercolour illustration — a small figure walks a path through a wildflower meadow toward soft morning light."
            width={2560}
            height={1396}
            className="mkt-paint-strong block w-full"
            loading="lazy"
          />
        </Reveal>
        <div className="px-6 pb-24 text-center sm:pb-28">
          <Link
            href="/find-care"
            className="group inline-flex h-12 items-center justify-center gap-1.5 rounded-field bg-primary px-7 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Find your provider
            <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </section>

      {/* ── H · Quiet band — the last breath before the footer ───────────── */}
      <section>
        <div className="mx-auto max-w-2xl px-6 pt-20 text-center sm:pt-24">
          <p className="text-balance font-display text-2xl font-medium tracking-tight text-text sm:text-[28px]">
            You&apos;re not alone in this.
          </p>
        </div>
        <Reveal className="mx-auto mt-10 max-w-6xl px-6">
          <img
            src={`${ILLO}/dusk-7.avif`}
            alt="A watercolour illustration — a small figure sits low in a wide meadow beneath a deep dusk sky, a warm band of light along the horizon."
            width={2176}
            height={1207}
            className="mkt-paint block w-full"
            loading="lazy"
          />
        </Reveal>
      </section>

      <MarketingFooter />
    </div>
  );
}

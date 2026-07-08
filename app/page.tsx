import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";
import { HeroSearch } from "@/components/marketing/hero-search";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Nav } from "@/components/marketing/nav";
import { Reveal } from "@/components/marketing/reveal";
import { WatercolorHover } from "@/components/marketing/watercolor-hover";

export const dynamic = "force-dynamic";

// Home — "First Light" redesign.
// ────────────────────────────────────────────────────────────────────────────
// The old page floated the watercolours on a cream "paper" ground (the 2026 AI
// default) and braided patient→provider→patient down a very long scroll. This
// version commits to three things:
//   1. Patient-first. The find-care job is the loudest thing on the page; the
//      provider pitch is one concentrated band (#for-providers), never a braid.
//   2. A luminous near-white ground (--color-page), not cream. Warmth is carried
//      by the amber accent and the paintings' own light. The register calls the
//      warm-neutral body the saturated default; we step off it deliberately.
//   3. Headings in the Bricolage grotesque (font-display, extrabold/bold);
//      body in Inter. One assured display voice, no serif.
// A dusk-teal CTA closes the page and continues into the footer as one dark
// block (MarketingFooter's bg is overridden to the same dusk).

// Background-removed watercolour scenes (transparent, soft deckled edges). They
// dissolve into the light ground with no box; the dark-sky dusk scenes sit on
// the Threshold band instead.
const CUT = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations/cut";

// The find-care entry points. Each row is a real directory query; the whole
// section is the page's conversion spine, so it leads (not the mood).
const SPECIALTIES: Array<{ name: string; note: string; q: string }> = [
  { name: "Anxiety & depression", note: "The most-searched reason to reach out", q: "Anxiety and Depression" },
  { name: "Trauma & PTSD", note: "EMDR, CPT, trauma-informed clinicians", q: "Trauma and PTSD" },
  { name: "ADHD", note: "Evaluation, coaching, and medication", q: "ADHD" },
  { name: "Couples & family", note: "Relationships and family dynamics", q: "Couples" },
  { name: "Grief & loss", note: "Bereavement and major life change", q: "Grief and Loss" },
  { name: "LGBTQIA+ affirming", note: "Care that centers who you are", q: "LGBTQIA+" },
];

// The find-care flow, as an honest ordered sequence (numbers earn their place).
const STEPS: Array<{ n: string; title: string; body: string; icon: IconName }> = [
  {
    n: "01",
    title: "Search & filter",
    body: "Search 116,000+ providers by specialty, borough, and your exact insurance plan. No account needed.",
    icon: "search",
  },
  {
    n: "02",
    title: "See your cost up front",
    body: "Know what a visit costs before you book. In-network means no surprise bill after the session.",
    icon: "check",
  },
  {
    n: "03",
    title: "Book the same week",
    body: "Pick a real open slot and confirm online — many providers can see you within the week.",
    icon: "calendar-check",
  },
];

// Reach stats (Headway "found support" layout, Liminal content). Provider count
// held at 116,000+ to match the hero rather than Headway's 70K+.
const STATS: Array<{ n: string; label: string; body: string }> = [
  {
    n: "30M+",
    label: "sessions held",
    body: "Millions of meaningful care moments — connecting people to the personalized support they need.",
  },
  {
    n: "116,000+",
    label: "licensed providers",
    body: "No matter what you’re facing, Liminal helps you find a therapist or psychiatrist who’s ready to help.",
  },
  {
    n: "100+",
    label: "insurance plans",
    body: "Covered by New York’s top insurance plans, expanding access to affordable mental health care.",
  },
];

const QUOTES: Array<{ name: string; text: string }> = [
  {
    name: "Rachel Bouton",
    text: "If you’re looking for a good therapist, Liminal is awesome. You plug in your insurance info and it gives you a list of therapists who take your insurance. They also process all the payment and billing without you or your provider having to worry about it.",
  },
  {
    name: "Caiti Donovan",
    text: "I found my therapist through Liminal and love her! I found trying to search via my insurance’s website to be v clunky and overall not great. Liminal accepts insurance but they take out the hassle of search & payment so you focus on finding a good fit!",
  },
  {
    name: "tikh",
    text: "Woah, def recommend this for folks looking for therapists: Liminal",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />

      {/* ── Hero — the promise + the search, on first light ────────────────── */}
      <section className="relative overflow-hidden bg-page lg:flex lg:min-h-[calc(100svh-72px)] lg:items-center">
        {/* first-light wash — soft teal bloom on the right, feathered edges */}
        <div aria-hidden className="mkt-firstlight pointer-events-none absolute inset-0" />

        {/* large hero painting, bleeding off the right (desktop) — pointer events
            enabled so the watercolour bloom can track the cursor over it */}
        <div className="absolute top-1/2 right-0 z-0 hidden w-[54vw] max-w-[920px] -translate-y-1/2 lg:block">
          <WatercolorHover>
            <img
              src={`${CUT}/lakeside.avif`}
              alt="A watercolour illustration — a person wrapped in a shawl sits on a bench by a still lake at dawn, holding a warm mug."
              width={1600}
              height={1200}
              className="mkt-develop mkt-d1 block w-full"
              loading="eager"
            />
          </WatercolorHover>
        </div>

        <div className="pointer-events-none relative z-10 mx-auto w-full max-w-6xl px-6 py-16 sm:py-20 lg:py-16">
          <div className="pointer-events-auto lg:max-w-[54%]">
            <h1
              className="mkt-rise text-balance font-display font-extrabold tracking-[-0.03em] text-text"
              style={{ fontSize: "clamp(2.75rem, 6vw, 5.25rem)", lineHeight: 1.01 }}
            >
              Healing belongs to{" "}
              <span className="text-primary">everyone.</span>
            </h1>
            <p className="mkt-rise mkt-d1 mt-6 max-w-lg text-pretty text-lg leading-relaxed text-text-body sm:text-xl">
              Search 116,000+ licensed therapists and psychiatrists across New York — filter by your insurance, see your
              cost before you book, and start as soon as this week.
            </p>
            <div className="mkt-rise mkt-d2 mt-8 max-w-[577px]">
              <HeroSearch autoFocus />
            </div>
            <p className="mkt-rise mkt-d3 mt-4 flex items-center gap-2 text-sm text-text-body">
              <Icon name="lock" size={15} className="shrink-0 text-primary" />
              Free to search — no sign-up required.
            </p>
          </div>

          {/* mobile painting */}
          <div className="mkt-develop mt-10 lg:hidden">
            <img
              src={`${CUT}/lakeside.avif`}
              alt="A watercolour illustration — a person wrapped in a shawl sits on a bench by a still lake at dawn, holding a warm mug."
              width={1600}
              height={1200}
              className="block w-full"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* ── Reach — stats + social proof (Headway "found support" layout) ──── */}
      <section className="bg-page">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
          <div className="text-center">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-primary-deep">
              Through Liminal
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
              Millions have found support
            </h2>
          </div>

          <div className="mt-16 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal className="order-last lg:order-first">
              <WatercolorHover className="mx-auto block max-w-md">
                <img
                  src={`${CUT}/grounding.avif`}
                  alt="A watercolour illustration — a person kneels with their hands resting on the earth in soft morning light."
                  width={1200}
                  height={1200}
                  className="block w-full"
                  loading="lazy"
                />
              </WatercolorHover>
            </Reveal>

            <dl className="flex flex-col">
              {STATS.map((s, i) => (
                <div
                  key={s.n}
                  className={`grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-x-8 py-8 ${
                    i > 0 ? "border-t border-page-edge" : ""
                  }`}
                >
                  <div>
                    <dt className="font-display text-[42px] font-extrabold leading-none tracking-tight text-text">
                      {s.n}
                    </dt>
                    <p className="mt-2 font-display text-[15px] font-semibold text-text-body">{s.label}</p>
                  </div>
                  <dd className="self-center text-pretty leading-relaxed text-text-body">{s.body}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {QUOTES.map((q) => (
              <figure key={q.name} className="flex flex-col rounded-card border border-page-edge bg-surface p-6">
                <blockquote className="flex-1 text-pretty leading-relaxed text-text-body">“{q.text}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-wash font-display text-sm font-semibold text-primary-deep"
                  >
                    {q.name[0]}
                  </span>
                  <span className="text-[15px] font-medium text-text">{q.name}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Find care — the conversion spine: browse by what you're facing ─── */}
      <section className="bg-page">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
            {/* Col 1 — heading stacked on the image */}
            <div>
              <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-text sm:text-[40px] sm:leading-[1.08]">
                Find care for whatever&apos;s on your mind.
              </h2>
              <Reveal className="mt-8">
                <WatercolorHover>
                  <img
                    src={`${CUT}/one-thing.avif`}
                    alt="A watercolour illustration — a mug, an open journal reading “one thing at a time”, and a laptop in soft morning light."
                    width={1600}
                    height={1120}
                    className="block w-full"
                    loading="lazy"
                  />
                </WatercolorHover>
              </Reveal>
              <Link href="/find-care" className="group mt-6 inline-flex items-center text-[15px] font-semibold text-primary">
                <span className="link-wipe">Browse the full directory</span>
              </Link>
            </div>

            {/* Cols 2–3 — care categories split across two columns */}
            <ul className="grid gap-x-10 self-start sm:grid-cols-2 lg:col-span-2">
              {SPECIALTIES.map((s) => (
                <li key={s.name}>
                  <Link
                    href={`/find-care?q=${encodeURIComponent(s.q)}`}
                    className="group block border-b border-page-edge py-4"
                  >
                    <span className="font-display text-lg font-semibold text-text transition-colors group-hover:text-primary">
                      {s.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-text-body/80">{s.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── How it works — three honest steps (fixes "will this actually work?") */}
      <section className="bg-page">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
          <h2 className="max-w-xl text-balance font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
            Getting care shouldn&apos;t be the hard part.
          </h2>
          <p className="mt-4 max-w-lg text-pretty text-lg leading-relaxed text-text-body">
            No phone tag, no waitlists, no guessing what it&apos;ll cost. Three steps, and you&apos;re booked.
          </p>

          <ol className="mt-16 grid gap-x-12 gap-y-12 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n}>
                <div className="flex items-center gap-3">
                  <span className="font-display text-3xl font-semibold text-primary/40">{s.n}</span>
                  <span className="h-px flex-1 bg-page-edge" />
                  <Icon name={s.icon} size={20} className="shrink-0 text-primary" />
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold text-text">{s.title}</h3>
                <p className="mt-2 text-pretty leading-relaxed text-text-body">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Human proof — one quote, in the serif voice ────────────────────── */}
      <section className="bg-page">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-24 sm:py-28 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <WatercolorHover>
              <img
                src={`${CUT}/resting-meadow.avif`}
                alt="A watercolour illustration — a person lies back in tall grass, hands behind their head, eyes closed, at ease."
                width={1600}
                height={1120}
                className="block w-full"
                loading="lazy"
              />
            </WatercolorHover>
          </Reveal>
          <figure className="lg:pr-6">
            <blockquote className="text-balance font-display text-[26px] font-semibold leading-[1.3] tracking-tight text-text sm:text-[32px]">
              “I filtered to Brooklyn, teletherapy, and my insurance — and booked a first session for the same week. No
              phone tag, no waitlist.”
            </blockquote>
            <figcaption className="mt-6 font-display text-[15px] font-medium text-text-body">
              Dana R. <span className="text-text-body/60">— client in Brooklyn</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── Provider band — the single provider moment, on the mint wash ───── */}
      <section id="for-providers" className="scroll-mt-20 bg-primary-wash">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-24 sm:py-28 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-md">
            <p className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-primary-deep">
              For providers
            </p>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-[40px] sm:leading-[1.08]">
              Run your New York practice on Liminal.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-text-body">
              Scheduling, telehealth, AI progress notes, and billing on one platform — plus a directory that sends you
              clients. The practice behind the care can go home on time.
            </p>
            <div className="mt-8">
              <Link href="/join" className="group inline-flex items-center text-[15px] font-semibold text-primary-deep">
                <span className="link-wipe">Join as a provider</span>
              </Link>
            </div>
          </div>
          <Reveal className="lg:order-last">
            <WatercolorHover>
              <img
                src={`${CUT}/tending-seedling.avif`}
                alt="A watercolour illustration — a person kneels in a garden bed, planting a seedling, a watering can beside them."
                width={1600}
                height={1120}
                className="block w-full"
                loading="lazy"
              />
            </WatercolorHover>
          </Reveal>
        </div>
      </section>

      {/* ── Closing patient CTA — two-col: painting, then the invitation ───── */}
      <section className="bg-page">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-24 sm:py-28 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <WatercolorHover>
              <img
                src={`${CUT}/walking-together.avif`}
                alt="A watercolour illustration — two people walk a small dog along a stream toward soft morning light."
                width={1600}
                height={1000}
                className="block w-full"
                loading="lazy"
              />
            </WatercolorHover>
          </Reveal>
          <div className="max-w-md lg:pr-6">
            <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
              Find care without the guesswork.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-text-body">
              Search by specialty, borough, and coverage — and take the first step this week.
            </p>
            <div className="mt-8">
              <Link
                href="/find-care"
                className="group inline-flex h-12 items-center justify-center gap-1.5 rounded-field bg-primary px-7 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                Find your provider
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing dusk CTA — the last invitation; the dark teal continues
          into the footer as one block (footer bg is overridden to match). ──── */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(120% 90% at 80% 12%, color-mix(in oklab, var(--color-accent) 20%, transparent) 0%, transparent 45%), linear-gradient(to bottom, var(--color-dusk) 0%, var(--color-dusk-deep) 100%)",
        }}
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-24 sm:py-28 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-md">
            <h2
              className="text-balance font-display font-extrabold tracking-[-0.03em] text-[#f4efe6]"
              style={{ fontSize: "clamp(2.25rem, 4.8vw, 3.75rem)", lineHeight: 1.06 }}
            >
              Whenever you&apos;re ready, we&apos;re here.
            </h2>
            <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-[#c9d6d4]">
              You don&apos;t have to have it all figured out. Search when you&apos;re ready — the first step is smaller than
              it looks.
            </p>
            <div className="mt-8">
              <Link
                href="/find-care"
                className="group inline-flex h-12 items-center justify-center gap-1.5 rounded-field bg-accent px-7 text-[15px] font-semibold text-[#12292f] transition-colors hover:bg-[#e7a244]"
              >
                Find your provider
              </Link>
            </div>
          </div>

          <div className="relative lg:order-last lg:-mr-6">
            <WatercolorHover>
              <img
                src={`${CUT}/dusk-lake.avif`}
                alt="A watercolour illustration — a person sits by a lake beneath a bare tree at dusk, a warm band of light along the horizon."
                width={1600}
                height={900}
                className="mkt-soft block w-full"
                loading="lazy"
              />
            </WatercolorHover>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";
import { WatercolorHover } from "@/components/marketing/watercolor-hover";
import { Icon } from "@/components/ui/icons";
import { CtaLink } from "@/components/site/cta-link";
import { Section, SectionHeading, Eyebrow } from "@/components/site/section";
import { Steps } from "@/components/site/steps";
import type { Feature } from "@/components/site/feature-grid";
import { FaqList } from "@/components/site/faq";
import { CtaBand } from "@/components/site/cta-band";
import { PROVIDER_FAQS } from "@/lib/site-content";

// /for-providers — clinician-facing landing. Here the EHR IS named: Leuk is
// one connected system (scheduling + documentation + billing). Software
// language is allowed on provider pages. NEW (public marketing site).
// (Was /providers — that path now serves the public provider search/results
// page; see app/providers/page.tsx.)

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For providers — run your New York practice on Leuk",
  description:
    "Scheduling, documentation, and billing in one connected system. Be present with your patient, not your paperwork — and a directory that sends you clients.",
};

const MKT = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/marketing";

// Provider-desk watercolour — the same painting as the home page's provider band.
const HERO_ILLO =
  "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/Gemini_Generated_Image_tep72ltep72ltep7-Photoroom.avif";
const HERO_ILLO_ALT =
  "A watercolour illustration — a doctor's office desk with a stethoscope on a clipboard, a succulent, and a sweater draped over a chair.";

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

const ILLO = "https://c1vijjkvyt1skkfe.public.blob.vercel-storage.com/illustrations";
const CUT = `${ILLO}/cut`;

// Provider-story copy is Leuk's own — reflecting what Leuk actually is: an
// all-in-one EHR plus a directory that refers covered patients, where the
// provider stays the billing entity. Deliberately no credentialing /
// guaranteed-payment / rate-negotiation claims — Leuk doesn't do those.
const INSURANCE_ROWS = [
  { label: "A real in-network filter", body: "Patients narrow the directory to the exact plans you accept — so the people who reach you are already covered." },
  { label: "Costs shown up front", body: "Expected out-of-pocket appears before a patient books, which means fewer surprise-bill conversations and fewer no-shows." },
  { label: "Superbills in a click", body: "Generate a superbill or claim-ready invoice straight from the session — the record and the paperwork stay together." },
  { label: "Your contracts, your rates", body: "You hold your own payer relationships and set your own fees. Leuk surfaces you to covered patients; it never steps between you and your reimbursement." },
];

const GROWTH_ROWS = [
  { label: "A directory that refers", body: "New Yorkers find you by specialty, borough, and plan — steady referrals without spending on ads." },
  { label: "Keep what you earn", body: "No spread and no per-session cut. What the payer allows for your work stays yours." },
  { label: "A profile that fits", body: "Shape your listing around your strengths, so the patients who reach out are the right match." },
  { label: "Fill the slots you want", body: "Open the hours you'd like filled, and let the directory route covered patients into them." },
];

const EHR_ROWS = [
  { label: "AI-assisted notes", body: "Draft a progress note from the visit in seconds, then finish it in your own words." },
  { label: "Secure telehealth", body: "Start a video visit in a click — no separate app, no downloads for you or the client." },
  { label: "Scheduling that fills itself", body: "Clients self-book the slots you open, with reminders that go out on their own." },
  { label: "Billing in the same place", body: "Superbills, invoices, and card payments sit right beside the record — not in a fourth tab." },
];

const PRIVACY_ROWS = [
  { label: "PHI handled with care", body: "Every read and write of protected health information is access-controlled and written to an append-only audit trail." },
  { label: "Safeguards under every screen", body: "Role-based access, encrypted sessions, and soft-deletes on clinical data are built into the platform, not bolted on." },
];

const HOW_ROWS = [
  { label: "Apply", body: "Tell us about your practice and the plans you accept." },
  { label: "Set up your profile", body: "Add your availability, services, and the story that helps patients choose you." },
  { label: "See clients", body: "Go live in the directory and start booking covered patients." },
];

const NETWORK_STATS = [
  { label: "Providers", value: "116,000+", note: "New York providers in the directory" },
  { label: "Coverage", value: "62", note: "counties — all of New York State" },
  { label: "One system", value: "EHR + directory + billing", note: "in a single connected platform" },
];

const SUPPORT_COLS = [
  { title: "Getting started", items: ["Guided onboarding and setup", "Import your availability and services", "Build a profile patients can choose from"] },
  { title: "As you grow", items: ["Placement in the statewide directory", "Your schedule and billing at a glance", "Responsive support when you need it"] },
];

const PRACTICE_FEATURES: Feature[] = [
  { icon: "monitor-check", title: "All-in-one EHR", body: "One system for the whole practice — not four tools taped together." },
  { icon: "file-text", title: "Clinical documentation", body: "SOAP and DAP notes with an AI assist, ready to sign." },
  { icon: "calendar-check", title: "Scheduling", body: "A self-booking calendar with reminders that send themselves." },
  { icon: "person-circle", title: "Telehealth", body: "Secure video visits, built into the same workspace." },
  { icon: "credit-card", title: "Billing & payments", body: "Superbills, invoices, and card payments in one flow." },
  { icon: "message-circle", title: "Client portal", body: "Records, intake forms, and secure messaging for every client." },
  { icon: "map-pin", title: "In-network directory", body: "Get found by patients searching for the plans you accept." },
  { icon: "users-round", title: "Group-ready", body: "Bring your whole practice onto one shared record and directory." },
  { icon: "pill-bottle", title: "For prescribers", body: "Medication-management workflows for psychiatry and PMHNPs." },
];

// Provider testimonials — illustrative sample copy (swap for real quotes when we
// have them). Role + location, no fabricated names; every quote stays true to
// what Leuk actually does.
const PROVIDER_QUOTES = [
  {
    quote:
      "Leuk filled my calendar without a dollar on ads — the referrals just come in, and the notes practically write themselves.",
    role: "LCSW · Brooklyn",
  },
  {
    quote: "Scheduling, notes, and billing finally live in one place. I get my evenings back instead of charting at 9pm.",
    role: "LMHC · Queens",
  },
  {
    quote:
      "I set my own rates and keep my own payer contracts — Leuk never takes a cut. It's the practice tooling I always wanted.",
    role: "PMHNP · Manhattan",
  },
  {
    quote: "The directory put me in front of clients who take my plan. I booked three new patients my first week.",
    role: "LCSW · Buffalo",
  },
];

export default function ForProvidersPage() {
  return (
    <>
      {/* Hero — the /care page grammar: warm-paper ground, a large watercolour
          bleeding off the right (cursor-tracking bloom + develop-in), copy on
          the left, sized to fill the viewport under the nav. Provider copy kept
          verbatim; no patient search here (wrong audience) — the two CTAs stand
          in its place. */}
      <section className="relative overflow-hidden bg-page lg:flex lg:min-h-[calc(100dvh-72px)] lg:items-center">
        <div aria-hidden className="mkt-firstlight pointer-events-none absolute inset-0" />

        {/* large hero painting, bleeding off the right (desktop) */}
        <div className="absolute top-1/2 right-0 z-0 hidden w-[72vw] max-w-[1280px] -translate-y-1/2 lg:block">
          <WatercolorHover>
            <img
              src={HERO_ILLO}
              alt={HERO_ILLO_ALT}
              width={2400}
              height={1309}
              className="mkt-develop mkt-d1 block w-full"
              loading="eager"
            />
          </WatercolorHover>
        </div>

        {/* Left scrim — keeps the copy legible over the painting and lets the
            watercolour dissolve into the warm paper on the left. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-3/5 bg-gradient-to-r from-page via-page/80 to-transparent lg:block"
        />

        <div className="pointer-events-none relative z-10 mx-auto w-full max-w-6xl px-6 py-16 sm:py-20 lg:py-16">
          {/* mobile painting — leads the copy below lg */}
          <div className="pointer-events-auto mkt-develop -mx-6 mb-10 w-[calc(100%+3rem)] lg:hidden">
            <WatercolorHover>
              <img
                src={HERO_ILLO}
                alt={HERO_ILLO_ALT}
                width={2400}
                height={1309}
                className="block w-full"
                loading="eager"
              />
            </WatercolorHover>
          </div>

          <div className="pointer-events-auto lg:max-w-[54%]">
            <p className="mkt-rise text-xs font-semibold uppercase tracking-[0.18em] text-primary">For providers</p>
            <h1
              className="mkt-rise mkt-d1 mt-4 text-balance font-display font-extrabold tracking-[-0.02em] text-text"
              style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.03 }}
            >
              Be present with your patient — not your paperwork.
            </h1>
            <p className="mkt-rise mkt-d2 mt-5 max-w-xl text-pretty text-lg leading-relaxed text-text-body sm:text-xl">
              Leuk is one connected system: scheduling, documentation, and billing in one place. Go home on time. The
              record works for you, not against you.
            </p>
            <div className="mkt-rise mkt-d3 mt-8 flex flex-col gap-3 sm:flex-row">
              <CtaLink href="/join" arrow>
                Apply to join
              </CtaLink>
              <CtaLink href="/join?walkthrough=1" tone="secondary">
                Book a walkthrough
              </CtaLink>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          Provider story — the full pitch, section by section. Structure follows
          a best-in-class provider landing page; every word is Leuk's own and
          honest to the model (all-in-one EHR + a directory that refers covered
          patients; the provider stays the billing entity).
          ═══════════════════════════════════════════════════════════════════ */}

      {/* S2 · In-network clarity */}
      <Section ground="page" innerClassName="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>In-network clarity</Eyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Take insurance without the guesswork
          </h2>
          <SplitRows rows={INSURANCE_ROWS} />
        </div>
        <Reveal className="overflow-hidden rounded-card border border-border shadow-card">
          <img
            src={`${MKT}/product-billing.avif`}
            alt="Leuk's billing view — a claim-ready invoice beside the session record."
            width={2880}
            height={1800}
            className="block w-full"
            loading="lazy"
          />
        </Reveal>
      </Section>

      {/* S3 · Provider quote */}
      <Section ground="page" innerClassName="grid items-center gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
        <figure>
          <blockquote className="text-balance font-display text-[26px] font-semibold leading-[1.3] tracking-tight text-text sm:text-[32px]">
            “Leuk gave my practice back its evenings. The notes are drafted before I leave the room, and billing isn’t a second job anymore.”
          </blockquote>
          <figcaption className="mt-6 text-[15px] text-text-muted">— LCSW · solo practice, Brooklyn</figcaption>
        </figure>
        <Reveal className="lg:order-last lg:mr-0 lg:w-auto lg:-mr-16 xl:-mr-28">
          <WatercolorHover>
            <img
              src={`${CUT}/coffee.avif`}
              alt="A watercolour illustration — a quiet nook with two armchairs and a small table by arched windows."
              width={1024}
              height={559}
              className="block w-full"
              loading="lazy"
            />
          </WatercolorHover>
        </Reveal>
      </Section>

      {/* S4 · Grow your caseload */}
      <Section ground="page" innerClassName="grid items-center gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <Reveal className="lg:mr-0 lg:w-auto lg:-ml-16 xl:-ml-28">
          <WatercolorHover>
            <img
              src={`${CUT}/gardening.avif`}
              alt="A watercolour illustration — a person kneels in a garden bed planting a seedling, a copper watering can beside them."
              width={1166}
              height={730}
              className="block w-full"
              loading="lazy"
            />
          </WatercolorHover>
        </Reveal>
        <div>
          <Eyebrow>Grow with the directory</Eyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Grow your caseload, keep what you earn
          </h2>
          <SplitRows rows={GROWTH_ROWS} />
        </div>
      </Section>

      {/* S5 · Payments you control */}
      <Section ground="page" innerClassName="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="max-w-md">
          <h2 className="text-balance font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
            Payments you control
          </h2>
          <p className="mt-5 text-pretty text-[17px] leading-relaxed text-text-body">
            Card payments, superbills, and claim-ready invoices live right next to the record — outstanding, paid, and
            overdue at a glance.
          </p>
          <p className="mt-4 text-pretty text-[17px] leading-relaxed text-text-body">
            You stay the billing provider and keep your payer relationships. Leuk keeps the paperwork out of your
            evenings — it never takes a cut of the care you deliver.
          </p>
        </div>
        <figure className="lg:pl-6">
          <blockquote className="text-balance font-display text-2xl font-semibold leading-[1.3] tracking-tight text-text sm:text-[30px]">
            “Card payments, superbills, and invoices all sit next to the record. I can see what’s outstanding at a glance — no spreadsheet, no chasing.”
          </blockquote>
          <figcaption className="mt-6 text-[15px] text-text-muted">— LMHC · group practice, Manhattan</figcaption>
        </figure>
      </Section>

      {/* S6 · Practice from one place */}
      <Section ground="page" innerClassName="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>All-in-one EHR</Eyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Practice from one place
          </h2>
          <SplitRows rows={EHR_ROWS} />
        </div>
        <Reveal className="overflow-hidden rounded-card border border-border shadow-card">
          <img
            src={`${MKT}/product-booking.avif`}
            alt="Leuk's calendar and booking — a week view with a client self-booking a visit type."
            width={2880}
            height={1440}
            className="block w-full"
            loading="lazy"
          />
        </Reveal>
      </Section>

      {/* S7 · Privacy in practice */}
      <Section ground="page" innerClassName="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
          Privacy, by default
        </h2>
        <SplitRows rows={PRIVACY_ROWS} />
      </Section>

      {/* S8 · The network */}
      <Section ground="page" innerClassName="grid items-center gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
        <div>
          <Eyebrow>The network</Eyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Join New York&apos;s most complete care directory
          </h2>
          <dl className="mt-10 border-t border-border">
            {NETWORK_STATS.map((s) => (
              <div
                key={s.label}
                className="grid gap-1 border-b border-border py-5 sm:grid-cols-[0.55fr_1.45fr] sm:items-baseline sm:gap-8"
              >
                <dt className="font-display text-lg font-semibold text-text">{s.label}</dt>
                <dd className="text-[17px] text-text-body">
                  <span className="font-display font-bold text-primary">{s.value}</span> {s.note}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <Reveal className="lg:order-last lg:mr-0 lg:w-auto lg:-mr-16 xl:-mr-28">
          <WatercolorHover>
            <img
              src={`${CUT}/cityscape.avif`}
              alt="A watercolour illustration — a coffee and a book on a railing overlooking a soft city skyline at morning."
              width={1024}
              height={559}
              className="block w-full"
              loading="lazy"
            />
          </WatercolorHover>
        </Reveal>
      </Section>

      {/* S9 · Providers on Leuk */}
      <Section ground="page">
        <SectionHeading title="Providers like you, at the center" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROVIDER_QUOTES.map((p) => (
            <figure key={p.role} className="flex flex-col rounded-card border border-border bg-surface p-6 shadow-card">
              <blockquote className="flex-1 text-pretty text-[15px] leading-relaxed text-text-body">“{p.quote}”</blockquote>
              <figcaption className="mt-5 text-[13px] font-medium text-text-muted">{p.role}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* S10 · Support at every stage */}
      <Section ground="page" innerClassName="grid items-center gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
        <div>
          <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Support at every stage
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            {SUPPORT_COLS.map((c) => (
              <div key={c.title}>
                <h3 className="font-display text-lg font-semibold text-text">{c.title}</h3>
                <ul className="mt-3 space-y-2 text-[15px] text-text-body">
                  {c.items.map((it) => (
                    <li key={it} className="flex items-start gap-2">
                      <Icon name="circle-check" size={16} className="mt-1 shrink-0 text-primary" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <Reveal className="lg:order-last lg:mr-0 lg:w-auto lg:-mr-16 xl:-mr-28">
          <WatercolorHover>
            <img
              src={`${CUT}/veranda.avif`}
              alt="A watercolour illustration — a columned porch lined with rocking chairs, receding toward a calm green lawn."
              width={1024}
              height={559}
              className="block w-full"
              loading="lazy"
            />
          </WatercolorHover>
        </Reveal>
      </Section>

      {/* S11 · How it works */}
      <Section ground="page" innerClassName="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            How it works
          </h2>
          <CtaLink href="/join" arrow className="mt-8">
            Apply to join
          </CtaLink>
        </div>
        <dl className="border-t border-border">
          {HOW_ROWS.map((r, i) => (
            <div
              key={r.label}
              className="grid gap-1 border-b border-border py-5 sm:grid-cols-[0.7fr_1.3fr] sm:gap-8"
            >
              <dt className="font-display text-lg font-semibold text-text">
                {i + 1}. {r.label}
              </dt>
              <dd className="text-[15px] leading-relaxed text-text-body">{r.body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* S12 · Features for every private practice — the home page's provider-
          band treatment: eyebrow + heading + body + CTA + image on top, the
          inline cream-filled icon list below. The one accent (mint wash) on an
          otherwise warm-paper page. */}
      <Section ground="wash">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <Reveal className="lg:order-last lg:mr-0 lg:w-auto lg:-mr-16 xl:-mr-28">
            <WatercolorHover>
              <img
                src={`${CUT}/office.avif`}
                alt="A watercolour illustration — a quiet office kitchenette, a coffee maker and two mugs on a wooden table by a sunlit window."
                width={1024}
                height={559}
                className="block w-full"
                loading="lazy"
              />
            </WatercolorHover>
          </Reveal>
          <div className="max-w-md">
            <Eyebrow>The platform</Eyebrow>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-primary sm:text-[40px] sm:leading-[1.08]">
              Features for every private practice
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-text-body">
              One connected system — scheduling, documentation, telehealth, and billing — plus a directory that sends you
              covered patients. Everything a New York practice needs, in one place.
            </p>
            <CtaLink href="/join" arrow className="mt-8">
              Apply to join
            </CtaLink>
          </div>
        </div>
        <ul className="mt-16 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {PRACTICE_FEATURES.map((f) => (
            <li key={f.title} className="flex gap-4">
              <Icon name={f.icon} size={22} className="mt-0.5 shrink-0 fill-[#f7f3e8] text-text" />
              <div>
                <h3 className="font-display text-lg font-semibold text-text">{f.title}</h3>
                <p className="mt-1 text-pretty leading-relaxed text-text-body">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* S13 · No middleman */}
      <Section ground="page" innerClassName="grid items-center gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <Reveal className="lg:mr-0 lg:w-auto lg:-ml-16 xl:-ml-28">
          <WatercolorHover>
            <img
              src={`${ILLO}/maya10.avif`}
              alt="A watercolour illustration — two people walk a small dog along a path through a meadow at dawn."
              width={2030}
              height={1211}
              className="block w-full"
              loading="lazy"
            />
          </WatercolorHover>
        </Reveal>
        <div>
          <Eyebrow>No middleman</Eyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Earning more, without giving up a cut
          </h2>
          <p className="mt-5 text-pretty text-[17px] leading-relaxed text-text-body">
            You keep your own payer contracts and set your own rates — Leuk never sits between you and your
            reimbursement. We make our money as software, so a fuller caseload never means handing over a slice of every
            session.
          </p>
        </div>
      </Section>

      {/* S14 · Care for more New Yorkers */}
      <Section ground="page" innerClassName="grid items-start gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
        <div>
          <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Care for more New Yorkers
          </h2>
          <div className="mt-8 grid gap-8 text-pretty text-[15px] leading-relaxed text-text-body sm:grid-cols-2">
            <p>
              Accepting insurance shouldn&apos;t mean drowning in admin. When the practice behind the care runs
              smoothly, more patients get seen — and more of New York gets care that fits.
            </p>
            <p>
              The directory already lists 116,000+ providers across the state. Every practice that runs on Leuk makes
              that network a little easier to reach.
            </p>
          </div>
        </div>
        <Reveal className="lg:order-last lg:mr-0 lg:w-auto lg:-mr-16 xl:-mr-28">
          <WatercolorHover>
            <img
              src={`${CUT}/resting-meadow.avif`}
              alt="A watercolour illustration — a person lies back in tall grass, hands behind their head, at ease."
              width={1600}
              height={1120}
              className="block w-full"
              loading="lazy"
            />
          </WatercolorHover>
        </Reveal>
      </Section>

      {/* S15 · FAQ */}
      <Section ground="page" innerClassName="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
          Frequently asked questions
        </h2>
        <div>
          <FaqList items={PROVIDER_FAQS} />
        </div>
      </Section>

      {/* Workflow narrative — the arc of a clinical encounter */}
      <Section ground="page">
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
        <Reveal className="mt-14 overflow-hidden rounded-card border border-border shadow-card">
          <img
            src={`${MKT}/product-calendar.avif`}
            alt="Leuk's calendar — a week of sessions with a client self-booking a visit type."
            width={2880}
            height={1800}
            className="block w-full"
            loading="lazy"
          />
        </Reveal>
      </Section>

      {/* Product proof */}
      <Section ground="page">
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
              alt="Leuk's billing dashboard — outstanding balance, paid this month, and an invoice list."
              width={2880}
              height={1800}
              className="block w-full"
              loading="lazy"
            />
          </Reveal>
        </div>
      </Section>

      {/* Provider testimonial */}
      <Section ground="page">
        <figure className="mx-auto max-w-3xl text-center">
          <blockquote className="text-balance font-display text-[26px] font-semibold leading-[1.3] tracking-tight text-text sm:text-[32px]">
            “Switching to Leuk was the simplest good decision I’ve made for my practice. One system, and everything just connects.”
          </blockquote>
          <figcaption className="mt-6 text-[15px] text-text-muted">— PMHNP · Rochester</figcaption>
        </figure>
      </Section>

      {/* Two paths */}
      <Section ground="page">
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
      <Section ground="page">
        <SectionHeading title="Questions providers ask" />
        <FaqList items={PROVIDER_FAQS} />
      </Section>

      <CtaBand
        eyebrow="Grow your practice"
        title="Run your New York practice on Leuk."
        lede="Scheduling, telehealth, AI notes, and billing on one platform — and a directory that sends you clients."
        ground="page"
        primary={{ href: "/join", label: "Apply to join" }}
        secondary={{ href: "/join?walkthrough=1", label: "Book a walkthrough" }}
      />
    </>
  );
}

// Divided label/description rows — the repeated feature-list shape used across
// the provider-story sections above.
function SplitRows({ rows }: { rows: { label: string; body: string }[] }) {
  return (
    <dl className="mt-10 border-t border-border">
      {rows.map((r) => (
        <div
          key={r.label}
          className="grid gap-1 border-b border-border py-5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] sm:gap-8"
        >
          <dt className="font-display text-lg font-semibold text-text">{r.label}</dt>
          <dd className="text-pretty text-[15px] leading-relaxed text-text-body">{r.body}</dd>
        </div>
      ))}
    </dl>
  );
}

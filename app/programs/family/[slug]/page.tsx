import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { WatercolorHover } from "@/components/marketing/watercolor-hover";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icons";
import { ProgramFilters, ProgramPagination } from "@/components/site/program-controls";
import { listProgramsByFamily, programFacets } from "@/lib/repos/directory";
import { familyBySlug, parsePopulations } from "@/lib/program-taxonomy";
import { FAMILY_CONTENT } from "@/lib/program-content";
import { titleCase } from "@/lib/format";
import type { DirectoryProgram } from "@/lib/types";

// /programs/family/[slug] — one plain-language page per program family
// (lib/program-taxonomy.ts). Server-rendered list driven by URL search params
// (county, audience, page); the client controls in program-controls.tsx only
// rewrite the URL. Crisis is the highest-value family and gets a county-first
// layout with 988 surfaced above the fold. NEW (marketing surface).

const PAGE_SIZE = 24;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const family = familyBySlug(slug);
  if (!family) return { title: "Programs · Leuk" };
  return {
    title: `${family.label} · Programs · Leuk`,
    description: FAMILY_CONTENT[slug]?.what ?? family.blurb,
  };
}

export default async function ProgramFamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ county?: string; audience?: string; page?: string }>;
}) {
  const { slug } = await params;
  const family = familyBySlug(slug);
  if (!family) notFound();
  const content = FAMILY_CONTENT[slug];

  const { county = "", audience = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const isCrisis = slug === "crisis";
  const basePath = `/programs/family/${slug}`;

  const [result, facets] = await Promise.all([
    listProgramsByFamily({ family: slug, county: county || undefined, population: audience || undefined, page, pageSize: PAGE_SIZE }),
    programFacets(),
  ]);

  const { items, total } = result;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />

      <main className="flex-1">
        {/* Hero — warm-paper ground, copy left, a watercolour bleeding off right. */}
        <section className="relative overflow-hidden bg-page">
          {content && (
            <div className="pointer-events-none absolute top-1/2 right-0 z-0 hidden w-[54vw] max-w-[900px] -translate-y-1/2 lg:block">
              <WatercolorHover className="pointer-events-auto">
                <img src={content.illo.src} alt={content.illo.alt} className="block w-full" loading="eager" />
              </WatercolorHover>
            </div>
          )}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-3/5 bg-gradient-to-r from-page via-page/85 to-transparent lg:block"
          />
          <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-14 sm:py-16">
            <div className="lg:max-w-[54%]">
              <Link href="/programs" className="group inline-flex items-center gap-1 text-sm font-medium text-primary">
                <span aria-hidden className="inline-block transition-transform group-hover:-translate-x-0.5">
                  ←
                </span>
                All programs
              </Link>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                New York Office of Mental Health
              </p>
              <h1
                className="mt-3 text-balance font-display font-extrabold tracking-[-0.02em] text-text"
                style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.05 }}
              >
                {family.label}
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-text-body">
                {content?.what ?? family.blurb}
              </p>
              <p className="mt-4 text-[15px] font-medium text-text-muted">
                {total.toLocaleString()} {total === 1 ? "program" : "programs"}
                {county ? ` in ${county} County` : " across New York"}
              </p>
            </div>
          </div>
        </section>

        {/* Crisis: 988 above the fold. */}
        {isCrisis && <CrisisHelpBlock />}

        {/* Who it's for / how you get connected. */}
        {content && (
          <section className="mx-auto w-full max-w-6xl px-6 pb-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard icon="users" label="Who it's for" text={content.who} />
              <InfoCard icon="corner-down-right" label="How to get connected" text={content.how} />
            </div>
          </section>
        )}

        {/* Directory. */}
        <section className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-12">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold tracking-tight text-text">
              {isCrisis ? "Find crisis help near you" : `${family.label} programs`}
            </h2>
            <p className="mt-1 text-[15px] text-text-body">
              {isCrisis
                ? "Start with your county — mobile-crisis teams, hotline centers, crisis beds, and respite are listed together below."
                : "Filter by county and who the program serves. Every program lists a phone number — call ahead to confirm details and how to enroll."}
            </p>
          </div>

          <ProgramFilters basePath={basePath} counties={facets.counties} county={county} audience={audience} />

          <div className="mt-6 flex items-baseline justify-between gap-4">
            <p className="text-sm text-text-muted">
              {total === 0 ? "No matching programs" : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
            </p>
            <p className="text-sm text-text-muted">Source: NY Office of Mental Health</p>
          </div>

          {items.length === 0 ? (
            <div className="mt-4 rounded-card border border-border bg-surface shadow-card">
              <EmptyState
                icon="search"
                title="No programs match these filters"
                subtext={
                  county
                    ? `We don't have ${family.label.toLowerCase()} programs on file in ${county} County. Try a nearby county or clear the filters.`
                    : "Try a different audience filter, or browse another program family."
                }
                actions={
                  <Link href={basePath} className="text-[15px] font-semibold text-primary hover:underline">
                    Clear filters
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {items.map((p) => (
                <li key={p.id}>
                  <ProgramRow program={p} icon={content?.icon ?? "hand-heart"} crisis={isCrisis} />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8">
            <ProgramPagination basePath={basePath} county={county} audience={audience} page={page} pageCount={pageCount} />
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

// ── pieces ───────────────────────────────────────────────────────────────────

function InfoCard({ icon, label, text }: { icon: IconName; label: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-primary-wash">
        <Icon name={icon} size={20} className="fill-surface text-primary" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="mt-0.5 text-[15px] leading-relaxed text-text-body">{text}</p>
      </div>
    </div>
  );
}

function CrisisHelpBlock() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pt-2 pb-6">
      <div className="flex flex-col gap-5 rounded-card border border-warning/40 bg-warning-tint/50 p-6 sm:flex-row sm:items-center">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-field bg-surface">
          <Icon name="phone" size={26} className="text-warning" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-text">Need help this moment?</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-text-body">
            The <strong>Suicide &amp; Crisis Lifeline</strong> is free, confidential, and staffed 24/7. Call or text{" "}
            <strong>988</strong> to reach a trained counselor in New York. If someone is in immediate danger, call 911.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 max-sm:w-full">
          <a
            href="tel:988"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-field bg-primary px-5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            <Icon name="phone" size={18} />
            Call 988
          </a>
          <a
            href="sms:988"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-field border border-field-border bg-surface px-5 text-[15px] font-semibold text-text transition-colors hover:bg-canvas"
          >
            Text 988
          </a>
        </div>
      </div>
    </section>
  );
}

// Short at-a-glance label for a crisis program, read straight off its OMH type.
function crisisTag(programType: string | null): string | null {
  if (!programType) return null;
  const t = programType.toLowerCase();
  if (t.includes("mobile")) return "Mobile crisis";
  if (t.includes("988") || t.includes("hotline")) return "24/7 hotline";
  if (t.includes("respite")) return "Crisis respite";
  if (t.includes("stabilization")) return "Stabilization center";
  if (t.includes("residen") || t.includes("beds")) return "Crisis beds";
  return null;
}

const POP_LABELS: Array<[key: "children" | "adolescents" | "adults", label: string]> = [
  ["children", "Children"],
  ["adolescents", "Teens"],
  ["adults", "Adults"],
];

function ProgramRow({ program, icon, crisis }: { program: DirectoryProgram; icon: IconName; crisis: boolean }) {
  const name = titleCase(program.programName);
  const type = program.programType ? titleCase(program.programType) : null;
  const agency = program.agency ? titleCase(program.agency) : null;
  const location = [program.city ? titleCase(program.city) : null, program.county ? `${program.county} County` : null]
    .filter(Boolean)
    .join(", ");
  const address = program.address ? titleCase(program.address) : null;
  const phone = program.phone && program.phone.toLowerCase() !== "not available" ? program.phone : null;
  const pops = parsePopulations(program.populations);
  const audienceTags = POP_LABELS.filter(([k]) => pops[k]).map(([, label]) => label);
  const tag = crisis ? crisisTag(program.programType) : null;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card transition-colors hover:border-primary/40 sm:flex-row sm:items-start">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field bg-primary-wash">
        <Icon name={icon} size={22} className="fill-surface text-primary" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/programs/${program.id}`} className="text-[17px] font-semibold text-text hover:text-primary hover:underline">
            {name}
          </Link>
          {tag && <Badge variant="warning">{tag}</Badge>}
        </div>
        {type && <p className="mt-0.5 text-[14px] text-text-body">{type}</p>}
        {agency && <p className="mt-0.5 text-[13px] text-text-muted">{agency}</p>}

        {(location || address) && (
          <p className="mt-2 flex items-start gap-1.5 text-[14px] text-text-body">
            <Icon name="map-pin" size={15} className="mt-0.5 shrink-0 text-primary" />
            <span>{[address, location].filter(Boolean).join(" · ")}</span>
          </p>
        )}

        {audienceTags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {audienceTags.map((a) => (
              <Badge key={a} variant="neutral">
                {a}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {phone && (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-field border border-field-border bg-surface px-4 text-[15px] font-semibold text-primary transition-colors hover:border-primary hover:bg-primary-wash max-sm:w-full"
        >
          <Icon name="phone" size={16} />
          {phone}
        </a>
      )}
    </div>
  );
}

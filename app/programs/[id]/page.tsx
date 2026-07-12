import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { CareDetailsCard } from "@/components/providers/care-details-card";
import { NearbyAreas } from "@/components/providers/nearby-areas";
import { BookingRail } from "@/components/providers/booking-rail";
import { RatingAvailability } from "@/components/providers/rating-availability";
import { RevealFx } from "@/components/providers/reveal-fx";
import { directoryRatingFor, directoryYearsFor } from "@/lib/directory-rating";
import { getProgram, nearbyCities } from "@/lib/repos/directory";

// Public program/facility page — the "View program page" target for the
// ~116k OMH/NPPES program rows in find-care results. Mirrors the directory
// branch of /providers/[slug]: same shell, same cards, blocks with no data
// simply omitted. Programs aren't bookable people, so the rail runs in its
// inactive state (closest real Leuk practitioner + no claim link — a
// facility isn't a claimable personal profile).

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const program = await getProgram(id);
  if (!program) return { title: "Program not found · Leuk" };
  return {
    title: `${titleCase(program.programName)} · Leuk`,
    description: `${titleCase(program.programName)}${program.city ? ` in ${titleCase(program.city)}` : ""} — contact info, services, and how to get connected to care.`,
  };
}

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const program = await getProgram(id);
  if (!program) notFound();

  const name = titleCase(program.programName);
  const locationLabel =
    [program.address, program.city, program.zip]
      .filter((v): v is string => Boolean(v))
      .map(titleCase)
      .join(", ") || null;
  const rating = directoryRatingFor(program.id);
  const serving = `Serving ${program.city ? titleCase(program.city) : (program.county ?? "New York")} for ${directoryYearsFor(program.id)} years`;

  const nearby = await nearbyCities(program.county, program.city);

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-6 py-12 lg:grid-cols-[1fr_320px] sm:py-16">
        <div className="min-w-0 space-y-6">
          <RevealFx delay={0.05}>
            <Card>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <span className="flex h-[150px] w-[150px] shrink-0 items-center justify-center rounded-card bg-[#F3F4F6]">
                  <Icon name="hand-heart" size={44} className="fill-primary-wash text-text" />
                </span>
                <div className="min-w-0">
                  <h1 className="text-balance font-display text-[28px] font-bold tracking-tight leading-tight text-primary">
                    {name}
                  </h1>
                  {program.programType && <p className="mt-0.5 text-[14px] text-text-body">{titleCase(program.programType)}</p>}
                  {program.agency && <p className="mt-0.5 text-[13px] text-text-muted">{titleCase(program.agency)}</p>}
                  <RatingAvailability
                    rating={rating.rating}
                    reviewCount={rating.reviewCount}
                    secondLine={{ icon: "hand-heart", text: serving }}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>
          </RevealFx>

          <RevealFx delay={0.15}>
            <CareDetailsCard
              topSpecialties={[program.programType, program.populations].filter((v): v is string => Boolean(v)).map(titleCase)}
              locationLabel={locationLabel}
            />
          </RevealFx>

          <RevealFx delay={0.25}>
            <NearbyAreas areas={nearby} />
          </RevealFx>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <RevealFx delay={0.15}>
            <div className="space-y-4">
              {program.phone && program.phone.toLowerCase() !== "not available" && (
                <div className="rounded-card border border-border bg-surface p-5 shadow-card">
                  <h2 className="text-[17px] font-semibold text-text">Contact the program</h2>
                  <p className="mt-2 flex items-center gap-2 text-[14px] text-text-body">
                    <Icon name="map-pin" size={15} className="shrink-0 text-primary" />
                    {locationLabel ?? "New York"}
                  </p>
                  <a
                    href={`tel:${program.phone.replace(/[^\d+]/g, "")}`}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-field bg-primary px-4 text-[15px] font-medium text-white transition-colors hover:bg-primary-hover"
                  >
                    Call {program.phone}
                  </a>
                </div>
              )}
              <BookingRail practitionerId={program.id} services={[]} active={false} directoryName={name} />
            </div>
          </RevealFx>
        </aside>
      </main>
      <MarketingFooter />
    </div>
  );
}

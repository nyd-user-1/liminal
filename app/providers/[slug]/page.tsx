import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Card } from "@/components/ui/card";
import { ClampText } from "@/components/providers/clamp-text";
import { IntroCard } from "@/components/providers/intro-card";
import { ProviderHeader } from "@/components/providers/provider-header";
import { QualificationsCard } from "@/components/providers/qualifications-card";
import { CareDetailsCard } from "@/components/providers/care-details-card";
import { NearbyAreas } from "@/components/providers/nearby-areas";
import { BookingRail } from "@/components/providers/booking-rail";
import { ProviderDirectoryRail } from "@/components/providers/provider-directory-rail";
import { ProviderPageSearch } from "@/components/providers/provider-page-search";
import { ProviderPanel } from "@/components/providers/provider-panel";
import { ProviderTopSection } from "@/components/providers/provider-top-section";
import { StickyBookBar } from "@/components/providers/sticky-book-bar";
import { RevealFx } from "@/components/providers/reveal-fx";
import { getPractitionerBySlug, listAvailability, listServices } from "@/lib/repos/services";
import { getProfileByUserId, nextAvailableLabel, spotlightRatingFor } from "@/lib/repos/provider-profiles";
import { getProviderBySlug, nearbyCities, providerFacets } from "@/lib/repos/directory";
import { listPayers } from "@/lib/repos/policies";

// The public provider profile — our version of Headway's provider page.
// Resolves BOTH sources through one dynamic segment, and they no longer share
// a layout, because they never really shared a shape:
//   - a bookable Liminal practitioner (users + provider_profiles) has an intro,
//     an approach, real availability. Card per section, sticky booking rail.
//   - a sparse NY directory row (directory_providers) has a name, a profession,
//     a license code and an address. Four facts across three cards read as an
//     empty page, so they fold into one ProviderPanel, the booking widget is
//     sized to stand beside it, and the rest of the directory follows a→z
//     beneath a search group that stays pinned under the nav.
//
// Note on the booking handoff: this page's own URL uses the persisted,
// human-readable slug, but /book/[slug] today resolves a raw practitioner
// user id (not a slug) — see BookingRail, which links to /book/{id}. If the
// booking flow later adopts this slug column for its own lookup, both routes
// converge on the same string for free.

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const practitioner = await getPractitionerBySlug(slug);
  if (practitioner) return { title: `${practitioner.name} · Liminal` };
  const directory = await getProviderBySlug(slug);
  if (directory) return { title: `${directory.name} · Liminal` };
  return { title: "Provider · Liminal" };
}

export default async function ProviderProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const practitioner = await getPractitionerBySlug(slug);
  if (practitioner) {
    const [profile, services, availability, payers] = await Promise.all([
      getProfileByUserId(practitioner.id),
      listServices(),
      listAvailability(practitioner.id),
      listPayers(),
    ]);
    const activeServices = services.filter((s) => s.active);
    const spotlightRating = spotlightRatingFor(practitioner.slug);

    return (
      <div className="flex min-h-screen flex-col bg-page">
        <Nav ground="bg-page" />
        <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-6 py-12 lg:grid-cols-[1fr_320px] sm:py-16">
          <div className="min-w-0 space-y-6">
            <RevealFx delay={0.05}>
              <Card>
                <ProviderHeader
                  name={practitioner.name}
                  avatarHue={practitioner.avatarHue}
                  illustrationKey={profile?.illustrationKey}
                  roleTitle={profile?.roleTitle}
                  yearsExperience={profile?.yearsExperience}
                  rating={spotlightRating?.rating}
                  reviewCount={spotlightRating?.reviewCount}
                  availableLabel={
                    spotlightRating ? nextAvailableLabel(availability.map((a) => a.weekday)) : undefined
                  }
                />
              </Card>
            </RevealFx>

            {profile?.introMd && (
              <RevealFx delay={0.15}>
                <IntroCard introMd={profile.introMd} identifyAs={profile.identifyAs} styleIs={profile.styleIs} />
              </RevealFx>
            )}

            {profile?.approachMd && (
              <RevealFx delay={0.25}>
                <Card>
                  <h2 className="mb-3 text-[19px] font-semibold text-text">My approach</h2>
                  <ClampText text={profile.approachMd} lines={4} />
                </Card>
              </RevealFx>
            )}

            {profile?.expectMd && (
              <RevealFx delay={0.35}>
                <Card>
                  <h2 className="mb-3 text-[19px] font-semibold text-text">What you can expect</h2>
                  <p className="whitespace-pre-line text-[15px] leading-relaxed text-text-body">{profile.expectMd}</p>
                </Card>
              </RevealFx>
            )}

            <RevealFx delay={0.45}>
              <QualificationsCard
                yearsExperience={profile?.yearsExperience}
                training={profile?.training}
                licenseType={profile?.licenseType}
                licensedIn={profile?.licensedIn}
                insuranceAccepted={profile?.insuranceAccepted}
              />
            </RevealFx>

            <RevealFx delay={0.55}>
              <CareDetailsCard
                topSpecialties={profile?.topSpecialties}
                moreSpecialties={profile?.moreSpecialties}
                therapyMethods={profile?.therapyMethods}
                careTypes={profile?.careTypes}
                agesServed={profile?.agesServed}
                languages={profile?.languages}
                locationLabel={profile?.locationLabel}
              />
            </RevealFx>

            <RevealFx delay={0.65}>
              <NearbyAreas areas={profile?.nearbyAreas} />
            </RevealFx>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <RevealFx delay={0.15}>
              <BookingRail
                practitionerId={practitioner.id}
                services={activeServices}
                payers={payers}
                availableWeekdays={availability.map((a) => a.weekday)}
                active
              />
            </RevealFx>
          </aside>
        </main>
        <MarketingFooter />
        <StickyBookBar service={activeServices[0]} />
      </div>
    );
  }

  const directory = await getProviderBySlug(slug);
  if (!directory) notFound();

  // Real nearby cities from the same county (not fabricated neighboring towns).
  const [nearby, facets] = await Promise.all([
    nearbyCities(directory.county, directory.city),
    providerFacets(),
  ]);
  const claimHref = `/join?claim=1&name=${encodeURIComponent(directory.name)}${
    directory.npi ? `&npi=${encodeURIComponent(directory.npi)}` : ""
  }${directory.licenseState ? `&state=${encodeURIComponent(directory.licenseState)}` : ""}`;

  const panel = {
    id: directory.id,
    name: directory.name,
    profession: directory.profession,
    credential: directory.credential ?? directory.taxonomy,
    licensedIn: directory.licenseState ? [directory.licenseState] : undefined,
    specialties: [...new Set([directory.subspecialty, directory.profession].filter((v): v is string => Boolean(v)))],
    locationLabel: [directory.address, directory.city, directory.zip].filter(Boolean).join(", ") || null,
    gender: directory.gender,
  };

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />
      {/* No top padding: the search group carries its own 30px inset (see
          ProviderTopSection), so it rests exactly where it will pin. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-12 sm:pb-16">
        <ProviderTopSection
          search={<ProviderPageSearch facets={facets} />}
          panel={
            <RevealFx delay={0.05} className="flex flex-1 flex-col">
              <ProviderPanel provider={panel} heading="h1" className="flex-1" />
            </RevealFx>
          }
          rail={
            <RevealFx delay={0.15} className="flex flex-1 flex-col">
              <BookingRail
                practitionerId={directory.id}
                services={[]}
                active={false}
                directoryName={directory.name}
                claimHref={claimHref}
                className="flex-1"
              />
            </RevealFx>
          }
        >
          <RevealFx delay={0.25}>
            <NearbyAreas areas={nearby} />
          </RevealFx>

          <ProviderDirectoryRail excludeId={directory.id} />
        </ProviderTopSection>
      </main>
      <MarketingFooter />
    </div>
  );
}

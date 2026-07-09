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
import { RevealFx } from "@/components/providers/reveal-fx";
import { getPractitionerBySlug, listServices } from "@/lib/repos/services";
import { getProfileByUserId } from "@/lib/repos/provider-profiles";
import { getProviderBySlug, nearbyCities } from "@/lib/repos/directory";

// The public provider profile — our version of Headway's provider page.
// Resolves BOTH sources through one dynamic segment: a bookable Liminal
// practitioner (users + provider_profiles, real availability) or a sparse
// NY directory row (directory_providers, no availability yet). Same layout
// either way; blocks with no data are simply omitted.
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
    const [profile, services] = await Promise.all([getProfileByUserId(practitioner.id), listServices()]);
    const activeServices = services.filter((s) => s.active);
    const virtual = profile?.careTypes.some((c) => c.toLowerCase().includes("telehealth")) ?? false;

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
                  locationLabel={profile?.locationLabel}
                  topSpecialty={profile?.topSpecialties[0]}
                  virtual={virtual}
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
              <BookingRail practitionerId={practitioner.id} services={activeServices} active />
            </RevealFx>
          </aside>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  const directory = await getProviderBySlug(slug);
  if (!directory) notFound();

  const locationLabel = [directory.address, directory.city, directory.zip].filter(Boolean).join(", ") || null;
  const topSpecialty = directory.subspecialty ?? directory.primaryTaxonomy ?? directory.profession ?? null;
  // Real nearby cities from the same county (not fabricated neighboring towns).
  const nearby = await nearbyCities(directory.county, directory.city);

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Nav ground="bg-page" />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-6 py-12 lg:grid-cols-[1fr_320px] sm:py-16">
        <div className="min-w-0 space-y-6">
          <RevealFx delay={0.05}>
            <Card>
              <ProviderHeader
                name={directory.name}
                roleTitle={directory.profession}
                locationLabel={locationLabel}
                topSpecialty={topSpecialty}
                directoryId={directory.id}
              />
            </Card>
          </RevealFx>

          <RevealFx delay={0.15}>
            <QualificationsCard
              licenseType={directory.credential ?? directory.taxonomy}
              licensedIn={directory.licenseState ? [directory.licenseState] : undefined}
            />
          </RevealFx>

          <RevealFx delay={0.25}>
            <CareDetailsCard
              topSpecialties={[directory.subspecialty, directory.primaryTaxonomy, directory.profession].filter(
                (v): v is string => Boolean(v),
              )}
              locationLabel={locationLabel}
            />
          </RevealFx>

          <RevealFx delay={0.35}>
            <NearbyAreas areas={nearby} />
          </RevealFx>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <RevealFx delay={0.15}>
            <BookingRail practitionerId={directory.id} services={[]} active={false} />
          </RevealFx>
        </aside>
      </main>
      <MarketingFooter />
    </div>
  );
}

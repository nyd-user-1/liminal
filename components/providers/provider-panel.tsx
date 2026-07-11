import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { InfoRow } from "@/components/providers/info-row";
import { ProviderIllustration } from "@/components/providers/provider-illustration";
import { RatingAvailability } from "@/components/providers/rating-availability";
import { directoryRatingFor } from "@/lib/directory-rating";
import { formatDate } from "@/lib/format";
import type { ProviderNetworkSummary } from "@/lib/repos/networks";

// The sparse-directory variant of the provider profile: one panel carrying
// what used to be three (header, "Qualification and insurance", "Care
// details"). An NPI row has a name, a profession, a license code and an
// address — three cards' worth of chrome around four facts read as a page
// that's mostly empty. Folded together, the same facts fill one panel that
// stands as tall as the booking rail beside it.
//
// Two uses, same component: the profile page's own first module (`heading:
// "h1"`, no href), and every row of the A–Z rail beneath it (`h2`, linked).
// Client-safe by construction — the seeded rating comes from
// lib/directory-rating, never from a repo (repos import lib/db).

export type ProviderPanelData = {
  id: string;
  name: string;
  profession?: string | null;
  /** License type — NPPES `credential`, falling back to the raw taxonomy code. */
  credential?: string | null;
  licensedIn?: string[];
  specialties?: string[];
  locationLabel?: string | null;
  gender?: string | null;
};

export function ProviderPanel({
  provider,
  heading = "h2",
  href,
  networkSummary,
  className = "",
}: {
  provider: ProviderPanelData;
  heading?: "h1" | "h2";
  /** When set, the whole panel is a link to the provider's profile. */
  href?: string;
  /** Insurance-network rollup (payer-networks data); omit/null when we hold none
      for this provider — absence renders nothing, never "out of network". */
  networkSummary?: ProviderNetworkSummary | null;
  className?: string;
}) {
  const { id, name, profession, credential, licensedIn, specialties, locationLabel, gender } = provider;
  const rating = directoryRatingFor(id);
  const Heading = heading;

  const hasQualification = Boolean(credential) || (licensedIn?.length ?? 0) > 0 || Boolean(networkSummary);
  const hasCare = (specialties?.length ?? 0) > 0 || Boolean(locationLabel);

  const body = (
    <>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ProviderIllustration
          name={name}
          directoryId={id}
          gender={gender}
          className="h-[180px] w-[180px] shrink-0 sm:h-[250px] sm:w-[250px]"
        />
        <div className="min-w-0 flex-1">
          <Heading className="text-balance font-display text-[28px] font-bold leading-tight tracking-tight text-primary">
            {name}
          </Heading>
          {profession && <p className="mt-1 text-[17px] text-text-body">{profession}</p>}
          {/* No location line here — "Care details" below carries the address. */}
          <RatingAvailability rating={rating.rating} reviewCount={rating.reviewCount} className="mt-3" />
        </div>
      </div>

      {(hasQualification || hasCare) && (
        <div className="mt-6 grid gap-x-8 gap-y-6 border-t border-page-edge pt-6 sm:grid-cols-2">
          {hasQualification && (
            <section>
              <h3 className="mb-4 text-[19px] font-semibold text-text">Qualification and insurance</h3>
              <div className="space-y-5">
                {credential && <InfoRow icon="circle-check" label="License type" value={credential} />}
                {licensedIn && licensedIn.length > 0 && (
                  <InfoRow icon="circle-check" label="Licensed in" value={licensedIn.join(", ")} />
                )}
                {networkSummary && (
                  <InfoRow
                    icon="shield-plus"
                    label="In-network"
                    value={
                      <div className="space-y-1.5">
                        <p className="font-medium text-text">{networkSummary.payers.join(", ")}</p>
                        {networkSummary.networks.length > 0 && (
                          <p className="text-[14px] text-text-muted">
                            {networkSummary.networks.slice(0, 5).join(", ")}
                            {networkSummary.networks.length > 5
                              ? `, +${networkSummary.networks.length - 5} more`
                              : ""}
                          </p>
                        )}
                        {networkSummary.accepting && (
                          <div className="pt-0.5">
                            <Badge variant="success">Accepting new patients</Badge>
                          </div>
                        )}
                        {networkSummary.asOf && (
                          <p className="text-[13px] text-text-muted">as of {formatDate(networkSummary.asOf)}</p>
                        )}
                      </div>
                    }
                  />
                )}
              </div>
            </section>
          )}

          {hasCare && (
            <section>
              <h3 className="mb-4 text-[19px] font-semibold text-text">Care details</h3>
              <div className="space-y-5">
                {specialties && specialties.length > 0 && (
                  <InfoRow icon="leaf" label="Specialties" value={specialties.join(", ")} />
                )}
                {locationLabel && <InfoRow icon="map-pin" label="Location" value={locationLabel} />}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );

  if (!href) return <Card className={className}>{body}</Card>;

  return (
    <Link href={href} className="group block">
      <Card className={`transition-colors group-hover:border-primary ${className}`}>{body}</Card>
    </Link>
  );
}

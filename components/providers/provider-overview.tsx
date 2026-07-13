"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";
import { InfoRow } from "@/components/providers/info-row";
import { formatDate, titleCase } from "@/lib/format";
import type { ProviderNetworkSummary } from "@/lib/repos/networks";
import type { DirectoryProvider } from "@/lib/types";

// Directory provider profile — Overview tab. Adapted from
// components/providers/provider-panel.tsx (the public-site sparse-profile
// precedent): same "fold near-empty cards into one, only render a section
// when it has content" idea, reused via the same InfoRow primitive. Rebuilt
// rather than reused as-is: provider-panel.tsx is a public-marketing card
// (illustration + fabricated star rating, "Insurance accepted" framed for a
// prospective client) — wrong register for an internal staff tool looking up
// a real NPI. This drops the illustration/rating and adds the operational
// fields the old SidePanel carried (license, practice, NPI verify, source).

type NpiVerifyState = { loading: boolean; result?: { found: boolean; status?: string; taxonomy?: string | null } };

export function ProviderOverview({
  provider,
  network,
}: {
  provider: DirectoryProvider;
  network: ProviderNetworkSummary | null;
}) {
  const [npi, setNpi] = useState<NpiVerifyState>({ loading: false });

  async function verifyNpi() {
    if (!provider.npi) return;
    setNpi({ loading: true });
    try {
      const res = await fetch(`/api/directory/npi?number=${provider.npi}`);
      const data = await res.json();
      setNpi({ loading: false, result: data });
    } catch {
      setNpi({ loading: false, result: { found: false } });
    }
  }

  const address = [provider.address, provider.city, provider.county, provider.zip]
    .filter(Boolean)
    .map((s) => titleCase(String(s)))
    .join(", ");

  const hasQualification = Boolean(provider.credential) || Boolean(provider.licenseNo) || Boolean(network);
  const hasCare =
    Boolean(provider.profession) || Boolean(provider.subspecialty) || Boolean(address) || Boolean(provider.phone);

  return (
    <div className="space-y-6">
      {(hasQualification || hasCare) && (
        <Card>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {hasQualification && (
              <section>
                <h2 className="mb-4 text-[17px] font-semibold text-text">Qualification and insurance</h2>
                <div className="space-y-5">
                  {provider.credential && (
                    <InfoRow icon="circle-check" label="License type" value={provider.credential} />
                  )}
                  {provider.licenseNo && (
                    <InfoRow
                      icon="circle-check"
                      label="License"
                      value={`${provider.licenseNo}${provider.licenseState ? ` · ${provider.licenseState}` : ""}`}
                    />
                  )}
                  {network && (
                    <InfoRow
                      icon="shield-plus"
                      label="In-network"
                      value={
                        <div className="space-y-1.5">
                          <p className="font-medium text-text">{network.payers.join(", ")}</p>
                          {network.networks.length > 0 && (
                            <p className="text-[14px] text-text-muted">
                              {network.networks.slice(0, 5).join(", ")}
                              {network.networks.length > 5 ? `, +${network.networks.length - 5} more` : ""}
                            </p>
                          )}
                          {network.accepting && (
                            <div className="pt-0.5">
                              <Badge variant="success">Accepting new patients</Badge>
                            </div>
                          )}
                          {network.asOf && (
                            <p className="text-[13px] text-text-muted">as of {formatDate(network.asOf)}</p>
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
                <h2 className="mb-4 text-[17px] font-semibold text-text">Care details</h2>
                <div className="space-y-5">
                  {provider.profession && (
                    <InfoRow icon="leaf" label="Specialty" value={titleCase(provider.profession)} />
                  )}
                  {provider.subspecialty && <InfoRow icon="leaf" label="Sub-specialty" value={provider.subspecialty} />}
                  {address && <InfoRow icon="map-pin" label="Address" value={address} />}
                  {provider.phone && (
                    <InfoRow
                      icon="phone"
                      label="Phone"
                      value={
                        <a href={`tel:${provider.phone}`} className="text-primary hover:underline">
                          {provider.phone}
                        </a>
                      }
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-[17px] font-semibold text-text">Provider record</h2>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {provider.gender && (
            <InfoRow
              icon="person-circle"
              label="Gender"
              value={provider.gender === "F" ? "Female" : provider.gender === "M" ? "Male" : provider.gender}
            />
          )}
          {(provider.isSoleProprietor || provider.parentOrg) && (
            <InfoRow
              icon="users"
              label="Practice"
              value={provider.isSoleProprietor ? "Solo practice" : titleCase(provider.parentOrg ?? "")}
            />
          )}
          {provider.enumerationDate && (
            <InfoRow icon="calendar" label="In practice since" value={provider.enumerationDate.slice(0, 4)} />
          )}
          {provider.npi && (
            <InfoRow
              icon="id-card"
              label="NPI"
              value={
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{provider.npi}</span>
                  {npi.result?.found ? (
                    <Badge variant="success">
                      <Icon name="check" size={12} /> {npi.result.status ?? "Verified"}
                    </Badge>
                  ) : npi.result && !npi.result.found ? (
                    <Badge variant="warning">Not found</Badge>
                  ) : npi.loading ? (
                    <Spinner size={14} />
                  ) : (
                    <TextLink onClick={verifyNpi}>Verify</TextLink>
                  )}
                </span>
              }
            />
          )}
          {npi.result?.taxonomy && <InfoRow icon="clipboard" label="NPPES taxonomy" value={npi.result.taxonomy} />}
          <InfoRow
            icon="globe"
            label="Source"
            value={
              provider.source === "nppes"
                ? "National NPI registry (NPPES)"
                : "NY Medicaid enrolled provider listing"
            }
          />
        </div>
      </Card>
    </div>
  );
}

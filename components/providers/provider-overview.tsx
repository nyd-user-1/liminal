"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { silhouetteUrl } from "@/components/providers/provider-illustration";
import {
  formatPhone,
  formatZip,
  providerDisplayName,
  shortProfession,
  stateFromZip,
  titleCase,
} from "@/lib/format";
import type { ProviderNetworkSummary } from "@/lib/repos/networks";
import type { AvatarHue, DirectoryProvider } from "@/lib/types";

// Directory provider — Overview tab's left rail. One single-column card: a
// fixed identity header (avatar · name · credential · address · phone, with
// the Accepting badge top-right) and hairline-divided sections of compact
// icon-less label/value rows that scroll INSIDE the card. The card keeps its
// full height (matching the table beside it) and its rounded chrome never
// scrolls away. A section only renders when it has content.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-6 first:pt-0 last:pb-0">
      <h2 className="mb-4 text-[17px] font-semibold text-text">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

// Stacked field: bold sub-header, value beneath, everything left-aligned —
// no divider lines, no icons (icons may return later).
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[15px] font-semibold text-text">{label}</p>
      <div className="mt-0.5 text-[15px] leading-relaxed text-text-body">{children}</div>
    </div>
  );
}

// Directory network labels arrive SHOUTING. Title-case only ALL-CAPS words of
// 4+ letters — short acronyms (EBH, UHC, PPO) stay caps, and already
// mixed-case labels pass through untouched.
function networkLabel(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.replace(/[A-Z]{4,}/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
}

export function ProviderOverview({
  provider,
  network,
  hue,
}: {
  provider: DirectoryProvider;
  network: ProviderNetworkSummary | null;
  hue: AvatarHue;
}) {
  const [copied, setCopied] = useState(false);

  function copyNpi() {
    if (!provider.npi) return;
    navigator.clipboard.writeText(provider.npi).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  // City, ZIP-derived state, ZIP+4 — the directory stores no practice state,
  // and the license state is wrong for out-of-state telehealth rows.
  const cityLine = [
    provider.city ? titleCase(provider.city) : null,
    [stateFromZip(provider.zip), formatZip(provider.zip)].filter(Boolean).join(" ") || null,
  ]
    .filter(Boolean)
    .join(", ");
  const address = [provider.address ? titleCase(provider.address) : null, cityLine].filter(Boolean).join(", ");

  const name = providerDisplayName(provider.name, provider.entityType);
  // Real NPPES credential ("PNP") beats the profession abbreviation.
  const roleShort = provider.credential ?? (provider.profession ? shortProfession(provider.profession) : null);
  // Orgs keep the initials circle — a human silhouette on a company row lies.
  const isPerson = provider.entityType === "1" || Boolean(provider.gender);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden !p-0">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar
            name={name}
            hue={hue}
            src={isPerson ? silhouetteUrl(provider.id, provider.gender) : undefined}
            size="lg"
            className="!h-11 !w-11 !text-base"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-bold leading-tight text-text">{name}</p>
            {roleShort && <p className="mt-0.5 truncate text-sm text-text-muted">{roleShort}</p>}
          </div>
          {network && (
            <Badge variant={network.accepting ? "success" : "neutral"} className="shrink-0 self-start">
              {network.accepting ? "Accepting" : "Not accepting"}
            </Badge>
          )}
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
        <div className="divide-y divide-border">
          {(address || provider.phone) && (
            <section className="py-6 first:pt-0 last:pb-0">
              <h2 className="mb-3 text-[17px] font-semibold text-text">Contact</h2>
              <div className="space-y-1 text-[15px] leading-relaxed text-text-body">
                {provider.address && <p>{titleCase(provider.address)}</p>}
                {cityLine && <p>{cityLine}</p>}
                {provider.phone && (
                  <p>
                    <a href={`tel:${provider.phone}`} className="text-primary hover:underline">
                      {formatPhone(provider.phone)}
                    </a>
                  </p>
                )}
              </div>
            </section>
          )}

          <Section title="Record">
            {provider.npi && (
              <Row label="NPI">
                <button
                  type="button"
                  onClick={copyNpi}
                  aria-label="Copy NPI"
                  className="-mx-2 -my-1 inline-flex items-center gap-2 rounded-field px-2 py-1 tabular-nums text-text-body transition-colors hover:bg-canvas"
                >
                  {provider.npi}
                  {copied ? (
                    <Icon name="check" size={14} className="text-success" />
                  ) : (
                    <Icon name="copy" size={14} className="text-text-muted" />
                  )}
                </button>
              </Row>
            )}
            {provider.profession && <Row label="Specialty">{titleCase(provider.profession)}</Row>}
            {provider.subspecialty && <Row label="Sub-specialty">{provider.subspecialty}</Row>}
            {provider.gender && (
              <Row label="Gender">
                {provider.gender === "F" ? "Female" : provider.gender === "M" ? "Male" : provider.gender}
              </Row>
            )}
            {(provider.isSoleProprietor || provider.parentOrg) && (
              <Row label="Practice">
                {provider.isSoleProprietor ? "Solo practice" : titleCase(provider.parentOrg ?? "")}
              </Row>
            )}
            {provider.enumerationDate && <Row label="In practice since">{provider.enumerationDate.slice(0, 4)}</Row>}
            {provider.credential && <Row label="License type">{provider.credential}</Row>}
            {provider.licenseNo && (
              <Row label="License">
                {provider.licenseNo}
                {provider.licenseState ? ` · ${provider.licenseState}` : ""}
              </Row>
            )}
            <Row label="Source">
              {provider.source === "nppes" ? "National NPI registry (NPPES)" : "NY Medicaid enrolled provider listing"}
            </Row>
          </Section>

          {network && (
            <section className="py-6 last:pb-0">
              <h2 className="mb-2 text-[17px] font-semibold text-text">In-Network</h2>
              <p className="text-[15px] text-text">{network.payers.join(", ")}</p>
              {network.networks.length > 0 && (
                <>
                  <h2 className="mb-2 mt-6 text-[17px] font-semibold text-text">Network</h2>
                  <ul className="space-y-1.5 text-[15px] leading-relaxed text-text">
                    {network.networks.map((n) => (
                      <li key={n}>{networkLabel(n)}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </Card>
  );
}

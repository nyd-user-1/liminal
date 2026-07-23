import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { ObjectPanel, ObjectField } from "@/components/ui/object-panel";
import { Tooltip } from "@/components/ui/tooltip";
import { normalizeOrgName, titleCase } from "@/lib/format";
import { formatTin } from "@/lib/repos/tin-registry";
import { OrgRailMenu } from "./org-rail-menu";
import type { OrgFhirName, OrgHeader } from "@/lib/repos/orgs";

// Organization object panel — the shared ObjectPanel anatomy (title + kebab,
// label-over-value fields, provenance footer). Names are payer-roster /
// NPI-registry attestations, never legal-entity lookups.

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Concise provenance label for the footer. */
function shortSource(source: string | null): string | null {
  if (!source) return null;
  if (source.startsWith("fhir-crosswalk")) return "payer roster";
  if (source.endsWith("mrf")) return "MRF";
  if (source.startsWith("nppes")) return "NPI registry";
  if (source === "directory") return "directory";
  if (source === "mock") return "sample";
  return source;
}

export function OrgRail({ header, fhirNames }: { header: OrgHeader; fhirNames: OrgFhirName[] }) {
  const nppes = header.nppes;
  const location = nppes
    ? [nppes.address ? titleCase(nppes.address) : null, nppes.city ? titleCase(nppes.city) : null, nppes.state]
        .filter(Boolean)
        .join(", ")
    : "";
  // Normalized, deduped alternate names — drop the one we already show as the
  // org name; cap the list so the rail stays tidy.
  const selfKey = key(header.name ?? "");
  const related = fhirNames
    .map((f) => ({ display: normalizeOrgName(f.display), npis: f.npis }))
    .filter((f) => key(f.display) !== selfKey)
    .slice(0, 6);
  const srcLabel = shortSource(header.nameSource);
  const footer = [header.asOf ? `Modified ${header.asOf}` : null, srcLabel].filter(Boolean).join(" · ");

  return (
    <ObjectPanel title={normalizeOrgName(header.label)} menu={<OrgRailMenu tin={header.tin} />} footer={footer || undefined}>
      <ObjectField label="Tax ID">{formatTin(header.tin)}</ObjectField>
      <ObjectField label="Clinicians">{header.npis.toLocaleString()}</ObjectField>
      <ObjectField label="Insurance plans">{String(header.payerCount)}</ObjectField>

      {nppes && (
        <>
          <ObjectField label="Organization NPI">
            <span className="tabular-nums">{nppes.npi}</span>
          </ObjectField>
          {/* NPPES writes "<UNAVAIL>" as its null marker — never render it. */}
          {nppes.otherName && !/^<.*>$/.test(nppes.otherName.trim()) && (
            <ObjectField label="Also known as">{normalizeOrgName(nppes.otherName)}</ObjectField>
          )}
          {nppes.taxonomy && <ObjectField label="Taxonomy">{nppes.taxonomy}</ObjectField>}
          {location && <ObjectField label="Location">{location}</ObjectField>}
          {nppes.authorizedOfficial && (
            <ObjectField label="Authorized official">{titleCase(nppes.authorizedOfficial)}</ObjectField>
          )}
        </>
      )}

      {related.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-sm text-text-muted">
            Related
            <Tooltip label="Also bills as">
              <Icon name="info" size={13} className="cursor-help text-text-muted" />
            </Tooltip>
          </div>
          {/* Each alias drills into the org index searched for that name —
              the marketing footer's row treatment (4% wash + ↗ on hover). */}
          <div className="mt-1.5 flex flex-col gap-1">
            {related.map((a) => (
              <Link
                key={a.display}
                href={`/orgs?q=${encodeURIComponent(a.display)}`}
                className="group -mx-2 flex items-center justify-between gap-2 rounded-field px-2 py-1.5 transition-colors hover:bg-black/[0.04]"
              >
                <span className="min-w-0">
                  <span className="block leading-snug text-text">{a.display}</span>
                  <span className="block text-[13px] text-text-muted">{a.npis.toLocaleString()} clinicians</span>
                </span>
                <span aria-hidden className="shrink-0 text-text-body opacity-0 transition-opacity group-hover:opacity-100">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </ObjectPanel>
  );
}

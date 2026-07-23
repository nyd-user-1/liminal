import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui/tooltip";
import { normalizeOrgName, titleCase } from "@/lib/format";
import { formatTin } from "@/lib/repos/tin-registry";
import { FieldDisplay } from "../../clients/ui";
import { OrgRailMenu } from "./org-rail-menu";
import type { OrgFhirName, OrgHeader } from "@/lib/repos/orgs";

// Organization identity rail — the client Contact card's layout (SettingsCard
// header + FieldDisplay label-over-value rows) at the provider rail's width
// (w-80), full height with a scrolling body and a provenance footer (mirrors
// the calendar rail's footer). Names are payer-roster / NPI-registry
// attestations, never legal-entity lookups.

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
    <Card className="flex h-full min-h-0 flex-col overflow-hidden !p-0">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-5 flex items-start gap-2.5">
          <h2 className="min-w-0 flex-1 text-[16px] font-semibold leading-snug text-text">{header.label}</h2>
          <OrgRailMenu tin={header.tin} />
        </div>

        <div className="flex flex-col gap-4">
          <FieldDisplay label="Tax ID" value={formatTin(header.tin)} />
          <FieldDisplay label="Clinicians" value={header.npis.toLocaleString()} />
          <FieldDisplay label="Payer books" value={String(header.payerCount)} />

          {nppes && (
            <>
              <FieldDisplay label="Organization NPI" value={<span className="tabular-nums">{nppes.npi}</span>} />
              {nppes.otherName && <FieldDisplay label="Also known as" value={titleCase(nppes.otherName)} />}
              {nppes.taxonomy && <FieldDisplay label="Taxonomy" value={nppes.taxonomy} />}
              {location && <FieldDisplay label="Location" value={location} />}
              {nppes.authorizedOfficial && (
                <FieldDisplay label="Authorized official" value={titleCase(nppes.authorizedOfficial)} />
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
        </div>
      </div>

      {footer && (
        <div className="shrink-0 border-t border-border px-6 py-3 text-[13px] text-text-muted">{footer}</div>
      )}
    </Card>
  );
}

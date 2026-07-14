import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { titleCase } from "@/lib/format";
import { formatTin } from "@/lib/repos/tin-registry";
import { FieldDisplay } from "../../clients/ui";
import { OrgRailMenu } from "./org-rail-menu";
import type { OrgFhirName, OrgHeader } from "@/lib/repos/orgs";

// Organization identity rail — the client Contact card's layout (SettingsCard
// header + FieldDisplay label-over-value rows), at the provider rail's width
// (w-80) and full height with a scrolling body. Reuses FieldDisplay so it
// stays visually identical to the client drill-down. Names are payer-roster /
// NPI-registry attestations, never legal-entity lookups — the source field and
// the "Also appears as" list keep that provenance visible.

const SOURCE_LABEL: Record<string, string> = {
  "nppes-org": "NPI registry (organization record)",
  "nppes-individual": "NPI registry (individual)",
  directory: "Provider directory",
  mock: "Sample data",
};

function sourceLabel(source: string | null): string | null {
  if (!source) return null;
  if (source.startsWith("fhir-crosswalk")) return "Matched via payer-roster crosswalk";
  if (source.endsWith("mrf")) return "Payer rate file (MRF)";
  return SOURCE_LABEL[source] ?? source;
}

export function OrgRail({ header, fhirNames }: { header: OrgHeader; fhirNames: OrgFhirName[] }) {
  const nppes = header.nppes;
  const src = sourceLabel(header.nameSource);
  // Distinct payer-published names other than the one we adopted as the org name.
  const aliases = fhirNames.filter((f) => f.display && f.display !== header.name);
  const location = nppes
    ? [nppes.address ? titleCase(nppes.address) : null, nppes.city ? titleCase(nppes.city) : null, nppes.state]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden !p-0">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <Icon name="id-card" className="shrink-0 text-text-body" />
          <h2 className="min-w-0 flex-1 truncate text-[19px] font-semibold text-text" title={header.label}>
            {header.label}
          </h2>
          <OrgRailMenu tin={header.tin} />
        </div>

        <div className="flex flex-col gap-4">
          <FieldDisplay label="Tax ID" value={formatTin(header.tin)} />
          <FieldDisplay label="Clinicians" value={header.npis.toLocaleString()} />
          <FieldDisplay label="Payer books" value={String(header.payerCount)} />
          {header.asOf && <FieldDisplay label="Evidence through" value={header.asOf} />}
          {src && <FieldDisplay label="Name source" value={src} />}

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

          {aliases.length > 0 && (
            <FieldDisplay
              label="Also appears as"
              value={
                <span className="mt-1 flex flex-col gap-2.5">
                  {aliases.map((a) => (
                    <span key={`${a.payer}|${a.display}`} className="block">
                      <span className="block leading-snug text-text">{a.display}</span>
                      <span className="text-[13px] text-text-muted">
                        {a.payer} · {a.npis.toLocaleString()} clinicians
                      </span>
                    </span>
                  ))}
                </span>
              }
            />
          )}
        </div>
      </div>
    </Card>
  );
}

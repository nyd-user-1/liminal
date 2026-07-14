import { Avatar, avatarHue } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { titleCase } from "@/lib/format";
import { formatTin } from "@/lib/repos/tin-registry";
import type { OrgFhirName, OrgHeader } from "@/lib/repos/orgs";

// Organization identity rail — mirrors ProviderOverview: a fixed header
// (avatar · name · TIN) over hairline-divided sections that scroll inside the
// card. Sections render only when they have content. Names are payer-roster /
// NPI-registry attestations, never legal-entity lookups — the source chip and
// the "also appears as" strip make that provenance visible.

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[15px] font-semibold text-text">{label}</p>
      <div className="mt-0.5 text-[15px] leading-relaxed text-text-body">{children}</div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold tabular-nums leading-none text-text">{value}</p>
      <p className="mt-1 text-[13px] text-text-muted">{label}</p>
    </div>
  );
}

export function OrgRail({ header, fhirNames }: { header: OrgHeader; fhirNames: OrgFhirName[] }) {
  const tinLabel = formatTin(header.tin);
  const src = sourceLabel(header.nameSource);
  const nppes = header.nppes;
  // Distinct payer-published names other than the one we adopted as the org name.
  const aliases = fhirNames.filter((f) => f.display && f.display !== header.name);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden !p-0">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={header.label} hue={avatarHue(header.tin)} size="lg" className="!h-11 !w-11 !text-base" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-bold leading-tight text-text" title={header.label}>
              {header.label}
            </p>
            <p className="mt-0.5 truncate text-sm tabular-nums text-text-muted">{tinLabel}</p>
          </div>
          {!header.name && (
            <Badge variant="neutral" className="shrink-0 self-start !font-normal">
              unnamed
            </Badge>
          )}
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
        <div className="divide-y divide-border">
          <section className="py-6 first:pt-0 last:pb-0">
            <div className="grid grid-cols-2 gap-5">
              <Stat value={header.npis.toLocaleString()} label="Clinicians" />
              <Stat value={String(header.payerCount)} label="Payer books" />
            </div>
            {header.asOf && <p className="mt-5 text-[13px] text-text-muted">Evidence through {header.asOf}</p>}
            {src && (
              <p className="mt-2 text-[13px] text-text-muted">
                Name source: <span className="text-text-body">{src}</span>
              </p>
            )}
          </section>

          {nppes && (
            <section className="py-6 last:pb-0">
              <h2 className="mb-4 text-[17px] font-semibold text-text">Registry record</h2>
              <div className="space-y-5">
                <Row label="Organization NPI">
                  <span className="tabular-nums">{nppes.npi}</span>
                </Row>
                {nppes.otherName && <Row label="Also known as">{titleCase(nppes.otherName)}</Row>}
                {nppes.taxonomy && <Row label="Taxonomy">{nppes.taxonomy}</Row>}
                {(nppes.address || nppes.city) && (
                  <Row label="Location">
                    {[nppes.address ? titleCase(nppes.address) : null, nppes.city ? titleCase(nppes.city) : null, nppes.state]
                      .filter(Boolean)
                      .join(", ")}
                  </Row>
                )}
                {nppes.authorizedOfficial && <Row label="Authorized official">{titleCase(nppes.authorizedOfficial)}</Row>}
              </div>
            </section>
          )}

          {aliases.length > 0 && (
            <section className="py-6 last:pb-0">
              <h2 className="mb-1 text-[17px] font-semibold text-text">Also appears as</h2>
              <p className="mb-3 text-[13px] text-text-muted">Names payers publish for this roster.</p>
              <ul className="space-y-2.5 text-[15px] leading-snug text-text">
                {aliases.map((a) => (
                  <li key={`${a.payer}|${a.display}`}>
                    <span className="block">{a.display}</span>
                    <span className="text-[13px] text-text-muted">
                      {a.payer} · {a.npis.toLocaleString()} clinicians
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </Card>
  );
}

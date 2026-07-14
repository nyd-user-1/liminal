import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getOrgFhirNames, getOrgHeader, getOrgRates, getOrgRoster } from "@/lib/repos/orgs";
import { OrgRail } from "./org-rail";
import { OrgEconomics } from "./org-economics";
import { OrgRoster } from "./org-roster";
import { OrgParticipation, OrgParticipationFallback } from "./org-participation";

// One organization's workspace — the ProviderView split: a w-80 identity rail
// (name · TIN · evidence · NPPES record · payer aliases) beside a scrolling
// content column (per-insurer rate economics, roster, network participation).
// Everything reads the sql/025 matviews through lib/repos/orgs.ts; the
// participation panel joins live participation, so it streams in via Suspense.

export const dynamic = "force-dynamic";

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ tin: string }>;
}) {
  await requireRole("practitioner");
  const { tin: raw } = await params;
  const tin = decodeURIComponent(raw);

  const [header, rates, fhirNames, roster] = await Promise.all([
    getOrgHeader(tin),
    getOrgRates(tin),
    getOrgFhirNames(tin),
    getOrgRoster(tin, { limit: 50 }),
  ]);
  if (!header) notFound();

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 lg:flex-row">
      <aside className="flex min-h-0 flex-col lg:h-full lg:w-80 lg:shrink-0">
        <OrgRail header={header} fhirNames={fhirNames} />
      </aside>

      {/* min-w-0 is load-bearing: without it this flex child grows past the
          viewport and the PAGE scrolls horizontally. Each table owns its own
          horizontal scroll (Table standard); this column owns the vertical. */}
      <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-y-auto">
        <OrgEconomics rates={rates} asOf={header.asOf} />
        <OrgRoster tin={tin} initial={roster.rows} total={roster.total} clinicians={header.npis} />
        <Suspense fallback={<OrgParticipationFallback />}>
          <OrgParticipation tin={tin} />
        </Suspense>
      </div>
    </div>
  );
}

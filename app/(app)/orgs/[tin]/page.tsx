import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getOrgFhirNames, getOrgHeader, getOrgRates, getOrgRoster } from "@/lib/repos/orgs";
import { OrgRail } from "./org-rail";
import { OrgJumpSearch } from "./org-jump-search";
import { OrgPanels } from "./org-panels";

// One organization's workspace — the SAME split as the directory drill-down
// (provider-view.tsx): a w-80 rail (jump-search over the identity card) beside
// a content column whose toggle chips swap a single scroll-owning table. The
// table owns the scroll, so the page itself never moves.

export const dynamic = "force-dynamic";

export default async function OrgDetailPage({ params }: { params: Promise<{ tin: string }> }) {
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

  // Outer flex-col (h-full, direct child of the scrolling <main>) → inner
  // min-h-0 flex-1 split. This is the pattern every full-height page uses; the
  // flex-ROW must be a BOUNDED flex-1 child, never the h-full element itself,
  // or <main> scrolls the whole page.
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        <aside className="flex min-h-0 flex-col gap-4 lg:h-full lg:w-80 lg:shrink-0">
          <OrgJumpSearch currentTin={tin} />
          <div className="min-h-0 flex-1">
            <OrgRail header={header} fhirNames={fhirNames} />
          </div>
        </aside>

        {/* min-w-0 is load-bearing: without it this flex child grows past the
            viewport and the PAGE scrolls horizontally. The active table owns
            both scroll axes (Table standard). */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <OrgPanels tin={tin} rates={rates} rosterInitial={roster.rows} rosterTotal={roster.total} />
        </div>
      </div>
    </div>
  );
}

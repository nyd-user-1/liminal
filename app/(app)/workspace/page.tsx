import { redirect } from "next/navigation";
import { BoardTabs } from "@/components/shell/board-tabs";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { TextLink } from "@/components/ui/text-link";
import { requireUser } from "@/lib/auth";
import { rateSignalCount, tableCount } from "@/lib/insights-metrics";
import { platformInventory } from "@/lib/repos/admin";
import { practiceSnapshot } from "@/lib/repos/dashboard";
import { latestLeadReport } from "@/lib/repos/lead-reports";
import { recentReports } from "@/lib/repos/reports";
import { recentSyncRuns, syncHealth } from "@/lib/repos/sync-runs";
import { CoverageGrowth } from "./coverage-growth";
import { Fleet } from "./fleet";
import { InsightsHeader } from "./insights-header";
import { NextRung } from "./next-rung";
import { NightReport } from "./night-report";
import { Observatory } from "./observatory";
import { ObjectStrip } from "./object-strip";
import { PracticeStrip } from "./practice-strip";
import { RunsPanel } from "./runs-panel";
import { EcoSection } from "./section";
import { SyncHealthCard } from "./sync-health";
import { Taste } from "./taste";
import { WorkQueue } from "./work-queue";

// /insights — the practice front door, and (for the founder) the ecosystem's
// front door beneath it. Two audiences, one page:
//
//   Layer 1  every staff role: today's caseload, scoped to who's asking.
//   Layer 2  admin only: the self-sustaining, self-healing data ecosystem, read
//            as one narrative column —
//              · the engine      coverage & growth (the corpus compounding nightly)
//              · overnight       the lead's night report, editable in place
//              · plumbing        the pipelines (sync-health + run history)
//              · the workforce   the ten-agent fleet + the reports it ships
//              · the next rung   the mechanisms that make it run itself
//              · taste           the standards that make ten agents read as one
//              · under the hood  the full platform inventory
//
// BoardTabs (Insights · Analytics · Dashboard) sit above everything.
// No page-level H1 — the TopBar owns it (ROUTE_TITLES → "Workspace").

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const user = await requireUser();
  // The workspace layout already bounces clients, but a layout and its page
  // render CONCURRENTLY — without this the page would still run its caseload
  // queries for a client-role user and ship a (zeroed) strip in the redirect's
  // payload. Own the contract here rather than inherit it from render order.
  if (user.role === "client") redirect("/portal");
  const isAdmin = user.role === "admin";

  // The observatory reads no PHI and the strip reads no platform tables, so the
  // flights go out together; each is independently memoized in its repo.
  const [snapshot, inventory, report, health, runs, reports] = await Promise.all([
    practiceSnapshot(user),
    isAdmin ? platformInventory() : null,
    isAdmin ? latestLeadReport() : null,
    isAdmin ? syncHealth() : null,
    isAdmin ? recentSyncRuns() : null,
    isAdmin ? recentReports() : [],
  ]);

  // The four objects the platform is built on — counts read straight off the
  // inventory the page already fetched (no request-time query), an estimate
  // where an exact count(*) would scan millions of rows.
  const objectCounts = {
    providers: inventory?.specials?.directoryNpis ?? null,
    rates: rateSignalCount(inventory),
    orgs: inventory?.specials?.rateTins ?? null,
    plans: tableCount(inventory, "form5500_filings"),
  };

  return (
    <div className="mx-auto flex min-w-0 max-w-[1400px] flex-col gap-6">
      <BoardTabs />

      {/* Orientation — a static Summary card; the page's only H1 is the TopBar's. */}
      <Card className="flex min-w-0 flex-col gap-1.5 p-5">
        <h2 className="text-[15px] font-semibold text-text">Summary</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-text-muted">
          The founder&apos;s control room. Up top, live counts of the four objects the platform is built on —
          providers, in-network rates, billing entities, plan filings — each opening to the tables behind it. Below
          sit an on-demand AI briefing, the work queue, the agent fleet, and last night&apos;s sync health.
        </p>
      </Card>

      {/* Layer 1 — the briefing, then the objects + the work queue (admin), or
          the practitioner's own day (everyone else). */}
      <section className="flex min-w-0 flex-col gap-4">
        <InsightsHeader canBrief={isAdmin} />
        {isAdmin ? (
          <div className="flex min-w-0 flex-col gap-4">
            <ObjectStrip counts={objectCounts} />
            <WorkQueue />
          </div>
        ) : (
          <PracticeStrip snapshot={snapshot} />
        )}
      </section>

      {/* Layer 2 — the ecosystem, as one narrative column (admin only). */}
      {isAdmin && (
        <>
          <Divider className="mt-2" />
          <div className="flex min-w-0 flex-col gap-12">
            <CoverageGrowth inventory={inventory} report={report} />

            {report && (
              <EcoSection icon="note" title="The night's work">
                <NightReport report={report} />
              </EcoSection>
            )}

            <Fleet />

            {health && (
              <EcoSection icon="wrench" title="Operations">
                <SyncHealthCard health={health} />
                <RunsPanel harvests={health.harvests} runs={runs ?? []} reports={reports} />
              </EcoSection>
            )}

            <NextRung />

            <Taste />

            {inventory && (
              <EcoSection
                icon="grid"
                title="Platform data"
                aside={
                  <TextLink href="/admin/data" className="text-sm">
                    Data dictionary
                  </TextLink>
                }
              >
                <Observatory groups={inventory.groups} />
              </EcoSection>
            )}
          </div>
        </>
      )}
    </div>
  );
}

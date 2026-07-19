import { redirect } from "next/navigation";
import { Divider } from "@/components/ui/divider";
import { TextLink } from "@/components/ui/text-link";
import { requireUser } from "@/lib/auth";
import { nightlyMetrics, rateSignalCount, tableCount } from "@/lib/insights-metrics";
import { platformInventory } from "@/lib/repos/admin";
import { practiceSnapshot } from "@/lib/repos/dashboard";
import { latestLeadReport } from "@/lib/repos/lead-reports";
import { recentReports } from "@/lib/repos/reports";
import { recentSyncRuns, syncHealth } from "@/lib/repos/sync-runs";
import { CoverageGrowth, type CoverageGrowthData } from "./coverage-growth";
import { Fleet } from "./fleet";
import { NightWork } from "./night-report";
import { Observatory } from "./observatory";
import { PracticeStrip } from "./practice-strip";
import { RulesPanel } from "./rules-panel";
import { RunsPanel } from "./runs-panel";
import { EcoSection } from "./section";
import { SummaryCard } from "./summary-card";
import { SyncHealthCard } from "./sync-health";

// /workspace — the practice front door, and (for the founder) the ecosystem's
// front door beneath it. Two audiences, one page:
//
//   Layer 1  every staff role: today's caseload, scoped to who's asking.
//   Layer 2  admin only: the self-sustaining, self-healing data ecosystem —
//              · the summary       an on-demand AI briefing, in the Summary card
//              · coverage & growth  the corpus compounding nightly + the pins
//              · operations         sync-health + the harvest/history/report/queue tabs
//              · overnight          the lead's night report, editable in a sheet
//              · the workforce      the ten-agent fleet
//              · rules              the standards that make ten agents read as one
//              · under the hood     the full platform inventory
//
// The workspace family (Workspace · Analytics · Dashboard · Data dictionary ·
// Docs) lives in the sidebar's collapsible Workspace section, not an in-page tab
// row. No page-level H1 — the TopBar owns it (ROUTE_TITLES → "Workspace").

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
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

  // The Coverage & growth scoreboard — counts straight off the inventory the
  // page already fetched, growth/coverage from the lead's night report so the
  // cards can never disagree with the prose the founder edits below.
  const m = nightlyMetrics(report?.bodyMd);
  const coverage: CoverageGrowthData = {
    providers: inventory?.specials?.directoryNpis ?? null,
    rateRows: m.rateRows ?? rateSignalCount(inventory),
    rateDelta: m.rateDelta,
    coveragePct: m.coveragePct,
    coverageDelta: m.coverageDelta,
    providersPriced: inventory?.specials?.rateNpis ?? null,
    payers: inventory?.specials?.ratePayers ?? null,
    billingEntities: inventory?.specials?.rateTins ?? null,
    planFilings: tableCount(inventory, "form5500_filings"),
  };

  return (
    <div className="mx-auto flex min-w-0 max-w-[1400px] flex-col gap-6">
      {/* The Summary card IS the briefing surface — orientation copy at rest,
          Claude's read of the overnight numbers when the wand is pressed. */}
      <SummaryCard canBrief={isAdmin} />

      {/* Layer 1 — the objects + the pins, then operations (admin), or the
          practitioner's own day (everyone else). */}
      {isAdmin ? (
        <div className="flex min-w-0 flex-col gap-8">
          <CoverageGrowth data={coverage} />
          {health && (
            <EcoSection title="Operations">
              <SyncHealthCard health={health} />
              <RunsPanel harvests={health.harvests} runs={runs ?? []} reports={reports} />
            </EcoSection>
          )}
        </div>
      ) : (
        <PracticeStrip snapshot={snapshot} />
      )}

      {/* Layer 2 — the ecosystem, as one narrative column (admin only). */}
      {isAdmin && (
        <>
          <Divider className="mt-2" />
          <div className="flex min-w-0 flex-col gap-12">
            {report && (
              <EcoSection title="The night's work">
                <NightWork report={report} />
              </EcoSection>
            )}

            <Fleet />

            <RulesPanel />

            {inventory && (
              <EcoSection
                title="Platform data"
                aside={
                  <TextLink href="/workspace/data-dictionary" className="text-sm">
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

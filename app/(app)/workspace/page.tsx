import { redirect } from "next/navigation";
import { BoardTabs } from "@/components/shell/board-tabs";
import { Divider } from "@/components/ui/divider";
import { requireUser } from "@/lib/auth";
import { nightlyMetrics, rateSignalCount, tableCount } from "@/lib/insights-metrics";
import { platformInventory } from "@/lib/repos/admin";
import { practiceSnapshot } from "@/lib/repos/dashboard";
import { insurerBoard, networkRowCount } from "@/lib/repos/insurers-board";
import { listLeadReports } from "@/lib/repos/lead-reports";
import { recentReports } from "@/lib/repos/reports";
import { recentSyncRuns, syncHealth } from "@/lib/repos/sync-runs";
import { CoverageGrowth, type CoverageGrowthData } from "./coverage-growth";
import { InsurersPanel } from "./insurers-panel";
import { Observatory } from "./observatory";
import { PracticeStrip } from "./practice-strip";
import { RunsPanel } from "./runs-panel";
import { EcoSection } from "./section";
import { SummaryCard } from "./summary-card";
import { UsageGauge } from "./usage-gauge";
import { Workbench } from "./workbench";

// /workspace — the practice front door, and (for the founder) the ecosystem's
// front door beneath it. Two audiences, one page:
//
//   Layer 1  every staff role: today's caseload, scoped to who's asking.
//   Layer 2  admin only: the self-sustaining, self-healing data ecosystem —
//              · the summary       an on-demand AI briefing, in the Summary card
//              · fuel              how much of the fleet's budget is spent
//              · coverage & growth  the corpus compounding nightly + the pins
//              · operations         the harvest/history/report/queue/anthem tables (each self-stamping its health)
//              · agents, reports
//                and rules          the fleet, what it shipped, and the standards
//                                   that make ten terminals read as one — one
//                                   section, three tabs, one kind of card
//              · under the hood     the full platform inventory
//              · insurers          the carrier registry, on the facts the schema holds
//
// BoardTabs (Workspace · Analytics · Dashboard · Data dictionary · Docs) sit at
// the top of the content, under the route H1 (the shell renders that H1 above
// every page — no page-level H1 here).

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
  const [snapshot, inventory, leadReports, health, runs, reports, insurers, networkRows] =
    await Promise.all([
      practiceSnapshot(user),
      isAdmin ? platformInventory() : null,
      isAdmin ? listLeadReports() : [],
      isAdmin ? syncHealth() : null,
      isAdmin ? recentSyncRuns() : null,
      isAdmin ? recentReports() : [],
      isAdmin ? insurerBoard() : [],
      isAdmin ? networkRowCount() : null,
    ]);
  // The Reports tab lists every night report; the scoreboard below reads its
  // growth numbers off the newest one — the same row, so a card and the prose
  // the founder edits can never disagree.
  const report = leadReports[0] ?? null;

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
      <BoardTabs />

      {/* The Summary card IS the briefing surface — orientation copy at rest,
          Claude's read of the overnight numbers when the wand is pressed. */}
      <SummaryCard canBrief={isAdmin} />

      {/* Layer 1 — the objects + the pins, then operations (admin), or the
          practitioner's own day (everyone else). */}
      {isAdmin ? (
        <div className="flex min-w-0 flex-col gap-8">
          <UsageGauge />
          <CoverageGrowth data={coverage} />
          {health && (
            <EcoSection title="Operations">
              <RunsPanel health={health} runs={runs ?? []} reports={reports} />
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
            <Workbench reports={leadReports} />

            {inventory && (
              <EcoSection title="Data">
                <Observatory groups={inventory.groups} />
              </EcoSection>
            )}

            <InsurersPanel insurers={insurers} networkRows={networkRows} />
          </div>
        </>
      )}
    </div>
  );
}

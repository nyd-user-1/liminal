import { redirect } from "next/navigation";
import { BoardTabs } from "@/components/shell/board-tabs";
import { Divider } from "@/components/ui/divider";
import { TextLink } from "@/components/ui/text-link";
import { requireUser } from "@/lib/auth";
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
import { PracticeStrip } from "./practice-strip";
import { RunHistory } from "./run-history";
import { EcoSection } from "./section";
import { SyncHealthCard } from "./sync-health";
import { Taste } from "./taste";

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
// No page-level H1 — the TopBar owns it (ROUTE_TITLES → "Insights").

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

  const firstName = user.name.split(" ")[0];

  const greeting =
    snapshot.scope === "all"
      ? `Good to see you, ${firstName}. Here's the whole practice today.`
      : `Good to see you, ${firstName}. Here's your day.`;

  return (
    <div className="mx-auto flex min-w-0 max-w-[1400px] flex-col gap-6">
      <BoardTabs />

      {/* Layer 1 — the practice, scoped to whoever's asking. */}
      <section className="flex min-w-0 flex-col gap-4">
        <InsightsHeader greeting={greeting} canBrief={isAdmin} />
        <PracticeStrip snapshot={snapshot} />
      </section>

      {/* Layer 2 — the ecosystem, as one narrative column (admin only). */}
      {isAdmin && (
        <>
          <Divider className="mt-2" />
          <div className="flex min-w-0 flex-col gap-12">
            <CoverageGrowth inventory={inventory} report={report} />

            {report && (
              <EcoSection
                icon="note"
                eyebrow="Overnight"
                title="The night's work"
                blurb="What every terminal shipped while you slept — the lead's digest, editable in place."
              >
                <NightReport report={report} />
              </EcoSection>
            )}

            {health && (
              <EcoSection
                icon="wrench"
                eyebrow="Plumbing"
                title="Pipelines"
                blurb="Is the data flowing, and is it healthy? The nightly matview rebuild and every harvest run, judged the same way everywhere."
              >
                <SyncHealthCard health={health} />
                {runs && runs.length > 0 && <RunHistory runs={runs} />}
              </EcoSection>
            )}

            <Fleet reports={reports} />

            <NextRung />

            <Taste />

            {inventory && (
              <EcoSection
                icon="grid"
                eyebrow="Under the hood"
                title="Platform data"
                blurb="Everything the platform holds, what each table means, and which page it powers. Counts are live — ≈ marks a planner estimate on tables too big to count on a page load."
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

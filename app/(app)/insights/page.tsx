import { redirect } from "next/navigation";
import { BoardTabs } from "@/components/shell/board-tabs";
import { Divider } from "@/components/ui/divider";
import { TextLink } from "@/components/ui/text-link";
import { requireUser } from "@/lib/auth";
import { platformInventory } from "@/lib/repos/admin";
import { practiceSnapshot } from "@/lib/repos/dashboard";
import { latestLeadReport } from "@/lib/repos/lead-reports";
import { InsightsHeader } from "./insights-header";
import { NightReport } from "./night-report";
import { Observatory } from "./observatory";
import { PracticeStrip } from "./practice-strip";

// /insights (né /dashboard) — the practice front door, and (for the founder)
// the platform observatory underneath it. Two audiences, one page:
//
//   Layer 1  every staff role: today's caseload, scoped to who's asking.
//   Layer 2  admin only: what the data platform actually holds, and which
//            page each table powers. Every card is click-to-copy.
//   Layer 3  admin only: the Briefing switch in the masthead — OFF by
//            default; flipping it swaps the greeting for Claude's headline +
//            article on the inventory. The model runs only from that switch.
//
// BoardTabs (Insights · Analytics · Dashboard) sit above everything — the
// standard visual point of reference across the three board surfaces.
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

  // The observatory reads no PHI and the strip reads no platform tables, so
  // both flights go out together; each is independently memoized in its repo.
  const [snapshot, inventory, report] = await Promise.all([
    practiceSnapshot(user),
    isAdmin ? platformInventory() : null,
    isAdmin ? latestLeadReport() : null,
  ]);

  const firstName = user.name.split(" ")[0];

  const greeting =
    snapshot.scope === "all"
      ? `Good to see you, ${firstName}. Here's the whole practice today.`
      : `Good to see you, ${firstName}. Here's your day.`;

  return (
    <div className="mx-auto flex min-w-0 max-w-[1400px] flex-col gap-6">
      <BoardTabs />
      <section className="flex min-w-0 flex-col gap-4">
        <InsightsHeader greeting={greeting} canBrief={isAdmin} />
        <PracticeStrip snapshot={snapshot} />
      </section>

      {isAdmin && report && (
        <>
          <Divider />
          <section className="flex min-w-0 flex-col gap-4">
            <NightReport report={report} />
          </section>
        </>
      )}

      {isAdmin && inventory && (
        <>
          <Divider />
          <section className="flex min-w-0 flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text">Platform data</h2>
              <p className="mt-0.5 max-w-3xl text-sm text-text-muted">
                Everything the platform holds, what each table means, and which page it powers. Counts are live — ≈ marks a
                planner estimate on tables too big to count on a page load. The{" "}
                <TextLink href="/admin/data" className="text-sm">
                  data dictionary
                </TextLink>{" "}
                has the full schema reference.
              </p>
            </div>

            <Observatory groups={inventory.groups} />
          </section>
        </>
      )}
    </div>
  );
}

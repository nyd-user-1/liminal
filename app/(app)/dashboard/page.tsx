import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BoardTabs } from "@/components/shell/board-tabs";
import { Divider } from "@/components/ui/divider";
import { TextLink } from "@/components/ui/text-link";
import { requireUser } from "@/lib/auth";
import { platformInventory } from "@/lib/repos/admin";
import { practiceSnapshot } from "@/lib/repos/dashboard";
import { BriefingCard, BriefingSkeleton } from "./briefing-card";
import { Observatory } from "./observatory";
import { PracticeStrip } from "./practice-strip";

// /dashboard — the practice front door, and (for the founder) the platform
// observatory underneath it. Two audiences, one page:
//
//   Layer 1  every staff role: today's caseload, scoped to who's asking.
//   Layer 2  admin only: what the data platform actually holds, and which
//            page each table powers.
//   Layer 3  admin only: Claude's read on Layer 2, cached 12h.
//
// No page-level H1 — the TopBar owns it (ROUTE_TITLES → "Dashboard").
// Server-rendered throughout; the only async boundary is the briefing, which
// streams so a cold model call never delays the numbers.

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  // The workspace layout already bounces clients, but a layout and its page
  // render CONCURRENTLY — without this the page would still run its caseload
  // queries for a client-role user and ship a (zeroed) strip in the redirect's
  // payload. Own the contract here rather than inherit it from render order.
  if (user.role === "client") redirect("/portal");
  const isAdmin = user.role === "admin";

  // The observatory reads no PHI and the strip reads no platform tables, so
  // both flights go out together; each is independently memoized in its repo.
  const [snapshot, inventory] = await Promise.all([
    practiceSnapshot(user),
    isAdmin ? platformInventory() : null,
  ]);

  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto flex min-w-0 max-w-[1400px] flex-col gap-6">
      <BoardTabs />
      <section className="flex min-w-0 flex-col gap-4">
        <p className="text-[15px] text-text-muted">
          {snapshot.scope === "all"
            ? `Good to see you, ${firstName}. Here's the whole practice today.`
            : `Good to see you, ${firstName}. Here's your day.`}
        </p>
        <PracticeStrip snapshot={snapshot} />
      </section>

      {isAdmin && inventory && (
        <>
          <Divider />
          <section className="flex min-w-0 flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text">Platform data</h2>
              <p className="mt-0.5 max-w-3xl text-sm text-text-muted">
                Everything the platform holds, what each table means, and which page it powers. Counts are live — a
                trailing + marks a planner estimate on tables too big to count on a page load. The{" "}
                <TextLink href="/admin/data" className="text-sm">
                  data dictionary
                </TextLink>{" "}
                has the full schema reference.
              </p>
            </div>

            <Suspense fallback={<BriefingSkeleton />}>
              <BriefingCard />
            </Suspense>

            <Observatory groups={inventory.groups} />
          </section>
        </>
      )}
    </div>
  );
}

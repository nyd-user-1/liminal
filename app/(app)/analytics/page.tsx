import { redirect } from "next/navigation";
import { BoardTabs } from "@/components/shell/board-tabs";
import { AnalyticsBoard } from "@/components/analytics/board";
import { requireUser } from "@/lib/auth";
import { analyticsData } from "@/lib/repos/analytics";

// /analytics — the composable KPI board.
//
// Server fetches every metric the viewer's role allows, in one memoized flight;
// the client board decides which of them are on screen, in what order, at what
// size. That split is deliberate and is hq's: the data is not the board, and a
// user rearranging cards must never re-hit the database.
//
// No page-level H1 — the TopBar owns it (ROUTE_TITLES → "Analytics").

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await requireUser();
  // The workspace layout bounces clients, but layout and page render
  // concurrently — own the contract here so no caseload query runs for them.
  if (user.role === "client") redirect("/portal");

  const { values, dictionary, generatedAt } = await analyticsData(user);

  return (
    <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-6">
      <BoardTabs />
      <AnalyticsBoard values={values} dictionary={dictionary} isAdmin={user.role === "admin"} generatedAt={generatedAt} />
    </div>
  );
}

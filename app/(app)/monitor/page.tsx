import { AuthError, requireRole } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { readMonitor } from "@/lib/repos/monitor";
import { MonitorView } from "./monitor-view";

// /monitor — database health, read from Postgres' own statistics views.
//
// The founder's framing: "Presently I have no visibility into Neon DB health,
// usage, etc. without looking into Neon itself." Everything on this page comes
// from the server we are already connected to, so it works with nothing more
// than DATABASE_URL. The panels that genuinely need Neon's control plane say so
// rather than inventing a number.
//
// Admin only, and server-read only — see lib/repos/monitor.ts for the queries
// and for the single THRESHOLDS object that tunes every check.
//
// No page-level H1: the TopBar owns it (route-title.ts -> "Monitor").

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  try {
    await requireRole("admin");
  } catch (e) {
    // A practitioner landing here gets a plain wall, not a stack trace.
    return (
      <div className="mx-auto flex min-w-0 max-w-[1200px] flex-col gap-4">
        <EmptyState
          icon="lock"
          title="Monitoring is admin-only"
          subtext={e instanceof AuthError ? e.message : "This page requires the admin role."}
        />
      </div>
    );
  }

  const snapshot = await readMonitor();

  if (!snapshot.available) {
    return (
      <div className="mx-auto flex min-w-0 max-w-[1200px] flex-col gap-4">
        <EmptyState
          icon="activity"
          title="No database is attached"
          subtext="Monitoring reads the live server's own statistics views. Without DATABASE_URL there is nothing to report — and an empty page is the honest answer, not a wall of zeroes."
        />
      </div>
    );
  }

  return <MonitorView snapshot={snapshot} />;
}

import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { attention, raiseMonitorAlerts, readMonitor } from "@/lib/repos/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/monitor — the monitoring surface's only face.
//
//   GET  — the snapshot the page renders. Admin only, read-only.
//   POST — evaluate the checks and raise notifications for anything that has
//          crossed a threshold. This is what makes the bell ring on its own.
//
// Nothing here reads or returns PHI: every figure comes from a Postgres
// statistics view, and the one field that could carry a value from a WHERE
// clause has its string literals masked inside the query (see lib/repos/monitor.ts).

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

export async function GET() {
  try {
    await requireRole("admin");
    const snapshot = await readMonitor();
    return NextResponse.json({ snapshot, attention: attention(snapshot) });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

/**
 * Raise alerts. Two callers, one door:
 *
 *  - an admin in the app (session cookie), and
 *  - the nightly runner (`Authorization: Bearer $CRON_SECRET`), which has no
 *    session to present.
 *
 * An unset CRON_SECRET closes the machine door rather than opening it — the
 * same reasoning as /api/cron/daily. A signed-in admin is always sufficient.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const machine = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
    if (!machine) await requireRole("admin");

    const snapshot = await readMonitor();
    if (!snapshot.available) {
      return NextResponse.json({ error: "No database attached." }, { status: 503 });
    }
    const { written, suppressed } = await raiseMonitorAlerts(snapshot);
    return NextResponse.json({
      checked: snapshot.checks.length,
      crossing: attention(snapshot).length,
      written,
      // Reported, not hidden: a suppressed alert is still a standing problem,
      // and silence about it would read as "nothing was wrong".
      suppressed,
    });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

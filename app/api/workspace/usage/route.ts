import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { usageGauge } from "@/lib/workspace-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The /workspace fuel gauge's only face. Read-only, admin-only: it reads the
// founder's local Claude Code state (~/.claude) and returns three rendered
// readings — never the raw snapshot, never a transcript line. Nothing here
// touches the database and nothing here is PHI.

export async function GET() {
  try {
    await requireRole("admin");
    return NextResponse.json(usageGauge());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

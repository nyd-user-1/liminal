import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { networkData } from "@/lib/repos/network-mapping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The network roster + crosswalk, for the /workspace Insurers section's Networks
// and Network mapping tabs. Read-only, admin-only, and fetched when a tab opens
// rather than during page render — the crosswalk's unmapped half groups over
// 13.7M rate rows and costs ~4.6s cold (see lib/repos/network-mapping.ts).
// No PHI: these are payer catalogue strings.

export async function GET() {
  try {
    await requireRole("admin");
    return NextResponse.json(await networkData());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

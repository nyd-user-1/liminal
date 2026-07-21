import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { networkData } from "@/lib/repos/network-mapping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The network roster + crosswalk, for the /workspace Insurers section's Networks
// and Network mapping tabs. Read-only, admin-only, and fetched when a tab opens
// rather than during page render — the crosswalk's unmapped half groups over
// 13.7M rate rows and costs ~4.6s cold (see lib/repos/network-mapping.ts).
// No PHI: these are payer catalogue strings.

// `?crosswalk=1` opts into the expensive half. Without it this answers the
// Networks tab from a 72-row join in ~18ms.
export async function GET(req: NextRequest) {
  try {
    await requireRole("admin");
    const crosswalk = req.nextUrl.searchParams.get("crosswalk") === "1";
    return NextResponse.json(await networkData({ crosswalk }));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

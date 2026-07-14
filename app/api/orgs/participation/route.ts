import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getOrgParticipation } from "@/lib/repos/orgs";

export const dynamic = "force-dynamic";

// Network participation for one org's detail panel (NYS-41). Split out so the
// content panel can lazy-load it on first view — it joins live participation
// (~1.5s on the biggest orgs) and shouldn't block the initial page. Public
// record, no logEvent.

/** GET /api/orgs/participation?tin=ein:832675429 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const tin = (req.nextUrl.searchParams.get("tin") ?? "").trim();
    if (!tin) return NextResponse.json({ error: "Provide a TIN." }, { status: 400 });
    const rows = await getOrgParticipation(tin);
    return NextResponse.json({ rows });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("orgs/participation", e);
    return NextResponse.json({ error: "Participation lookup failed." }, { status: 500 });
  }
}

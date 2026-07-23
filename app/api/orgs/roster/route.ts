import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getOrgRoster } from "@/lib/repos/orgs";

export const dynamic = "force-dynamic";

// Paged roster for one organization's detail page (NYS-41). The org page
// server-renders the first page; this route serves "load more" (Headway alone
// is 13,614 clinicians). Public-record data, no logEvent.

/** GET /api/orgs/roster?tin=ein:832675429&offset=50&limit=50 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const tin = (req.nextUrl.searchParams.get("tin") ?? "").trim();
    if (!tin) return NextResponse.json({ error: "Provide a TIN." }, { status: 400 });
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
    const q = req.nextUrl.searchParams.get("q") ?? undefined;
    const page = await getOrgRoster(tin, {
      offset: Number.isFinite(offset) ? offset : 0,
      limit: Number.isFinite(limit) ? limit : 50,
      q,
    });
    return NextResponse.json(page);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("orgs/roster", e);
    return NextResponse.json({ error: "Roster lookup failed." }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { searchPrograms } from "@/lib/repos/directory";

export const dynamic = "force-dynamic";

/** GET /api/directory/programs?q=&county=&type=&page= — paged search. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const p = req.nextUrl.searchParams;
    const page = await searchPrograms({
      q: p.get("q") ?? undefined,
      county: p.get("county") ?? undefined,
      type: p.get("type") ?? undefined,
      page: Number(p.get("page")) || 1,
    });
    return NextResponse.json(page);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

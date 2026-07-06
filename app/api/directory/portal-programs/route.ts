import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { searchNycResources } from "@/lib/repos/directory";

export const dynamic = "force-dynamic";

/** GET /api/directory/portal-programs?q=&category= — NYC resources (any signed-in user). */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const p = req.nextUrl.searchParams;
    const programs = await searchNycResources({
      q: p.get("q") ?? undefined,
      category: p.get("category") ?? undefined,
    });
    return NextResponse.json({ programs });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

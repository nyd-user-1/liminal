import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getPercentilePlacement } from "@/lib/repos/rate-signals";

export const dynamic = "force-dynamic";

// Public-record payer data (TiC MRFs) — not PHI, no logEvent.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/** GET /api/rates/placement?payer=&code=&tin= — where a TIN's schedule sits in the payer's book. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const payer = req.nextUrl.searchParams.get("payer")?.trim() ?? "";
    const code = req.nextUrl.searchParams.get("code")?.trim() ?? "";
    const tin = req.nextUrl.searchParams.get("tin")?.trim() ?? "";
    if (!payer || !/^\d{5}$/.test(code) || !tin) {
      return NextResponse.json({ error: "Provide payer, a 5-digit code, and tin." }, { status: 400 });
    }
    const placement = await getPercentilePlacement(payer, code, tin);
    return NextResponse.json({ placement });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

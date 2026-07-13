import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getStanding } from "@/lib/repos/rate-signals";

export const dynamic = "force-dynamic";

// Negotiated-rate signals are payer-published public-record data (TiC MRFs),
// not PHI — looking up any NPI is the feature, so no logEvent on these routes.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

const MAX_NPIS = 5;

/** GET /api/rates/standing?npis=1234567890,… — where each NPI stands, per payer book. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const npis = [...new Set((req.nextUrl.searchParams.get("npis") ?? "").split(","))]
      .map((s) => s.trim())
      .filter((s) => /^\d{10}$/.test(s));
    if (npis.length === 0) {
      return NextResponse.json({ error: "Provide one or more 10-digit NPIs." }, { status: 400 });
    }
    const standings = await Promise.all(npis.slice(0, MAX_NPIS).map(getStanding));
    return NextResponse.json({ standings });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

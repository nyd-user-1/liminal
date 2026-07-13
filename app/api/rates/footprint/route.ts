import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getCredentialingFootprint } from "@/lib/repos/rate-signals";

export const dynamic = "force-dynamic";

// Public-record payer data (TiC MRFs) + statewide directory identity — not PHI, no logEvent.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

const MAX_NPIS = 4;

/** GET /api/rates/footprint?npis=1234567890,… — the recruiting/credentialing reveal per NPI. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const npis = [...new Set((req.nextUrl.searchParams.get("npis") ?? "").split(","))]
      .map((s) => s.trim())
      .filter((s) => /^\d{10}$/.test(s));
    if (npis.length === 0) {
      return NextResponse.json({ error: "Provide one or more 10-digit NPIs." }, { status: 400 });
    }
    const footprints = await Promise.all(npis.slice(0, MAX_NPIS).map(getCredentialingFootprint));
    return NextResponse.json({ footprints });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

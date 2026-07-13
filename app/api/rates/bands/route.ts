import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getRateBands } from "@/lib/repos/rate-signals";

export const dynamic = "force-dynamic";

// Public-record payer data (TiC MRFs), not PHI — no logEvent.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

const MAX_CODES = 8;

/** GET /api/rates/bands?codes=90837,90834 — per-payer p25/median/p75, NY book. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const codes = [...new Set((req.nextUrl.searchParams.get("codes") ?? "").split(","))]
      .map((s) => s.trim())
      .filter((s) => /^\d{5}$/.test(s));
    if (codes.length === 0) {
      return NextResponse.json({ error: "Provide one or more 5-digit CPT codes." }, { status: 400 });
    }
    const bands = await getRateBands(codes.slice(0, MAX_CODES));
    return NextResponse.json({ bands });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

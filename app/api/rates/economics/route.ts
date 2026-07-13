import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getAffiliationEconomics } from "@/lib/repos/rate-signals";

export const dynamic = "force-dynamic";

// Public-record payer data (TiC MRFs) — not PHI, no logEvent.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/** GET /api/rates/economics?npi= — per-payer multi-TIN rate comparison cards. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const npi = req.nextUrl.searchParams.get("npi")?.trim() ?? "";
    if (!/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: "Provide a 10-digit NPI." }, { status: 400 });
    }
    const cards = await getAffiliationEconomics(npi);
    return NextResponse.json({ cards });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

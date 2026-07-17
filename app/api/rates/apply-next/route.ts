import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getApplyNext, listNegotiableBooks } from "@/lib/repos/rate-signals";

export const dynamic = "force-dynamic";

// Public-record payer data (TiC MRFs) + statewide directory identity — not PHI, no logEvent.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/**
 * GET /api/rates/apply-next?npi=&sessions=
 *
 * With an NPI: ranked, priced credentialing GAPS (the books that clinician is
 * absent from). Without one: the whole negotiable market — every NY book with
 * its headline economics — so the tab opens on a listing, not a blank prompt.
 * The NPI reduces the market to the gaps.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const npi = req.nextUrl.searchParams.get("npi")?.trim() ?? "";
    const sessionsParam = req.nextUrl.searchParams.get("sessions");
    const sessionsPerWeek = sessionsParam && Number.isFinite(Number(sessionsParam)) ? Number(sessionsParam) : undefined;

    if (!npi) {
      const { books } = await listNegotiableBooks({ sessionsPerWeek });
      return NextResponse.json({ books });
    }
    if (!/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: "Provide a 10-digit NPI." }, { status: 400 });
    }
    const result = await getApplyNext(npi, { sessionsPerWeek });
    return NextResponse.json({ result });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

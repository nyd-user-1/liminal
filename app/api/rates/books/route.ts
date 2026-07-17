import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { listRateBooks } from "@/lib/repos/rate-signals";

export const dynamic = "force-dynamic";

// Public-record payer data (TiC MRFs) + statewide directory identity — not PHI, no logEvent.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/**
 * GET /api/rates/books?q=&npi=&limit= — every payer×holder book we index.
 *
 * The listing the Roster check OPENS on, rather than the blank box it used to
 * open on: no params = the whole book (biggest rosters first), `q` narrows by
 * payer or holder, `npi` reduces to the books publishing that clinician.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const p = req.nextUrl.searchParams;
    const npi = (p.get("npi") ?? "").trim();
    if (npi && !/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: "NPI must be 10 digits." }, { status: 400 });
    }
    const result = await listRateBooks({
      q: p.get("q") ?? undefined,
      npi: npi || undefined,
      limit: Number(p.get("limit")) || undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

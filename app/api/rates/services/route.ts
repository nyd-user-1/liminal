import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { RATE_ROW_CODES, listRateRows, rateRowFacets, type RateRowCode } from "@/lib/repos/rate-rows";

export const dynamic = "force-dynamic";

// Public-record payer data (TiC MRFs), not PHI — no logEvent, same as the
// sibling /api/rates/bands.
//
// A NEW route under an explicit carve-out: app/api/rates/* is another session's
// tonight, and this directory is mine (lead ruling, 2026-07-17). It sits beside
// /bands rather than extending it — bands answer "what does the cohort pay",
// this answers "what did the payer publish, row by row".

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

const num = (v: string | null, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * GET /api/rates/services?q=&payer=&code=&network=&limit=&offset=
 *   → { rows, total, facets }
 *
 * Server-paginated: 425k service rows unpivot out of rate_table_child_mv, so
 * the page is never computed client-side. `total` is the full match count.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const p = req.nextUrl.searchParams;
    const code = p.get("code");

    const [{ rows, total }, facets] = await Promise.all([
      listRateRows({
        q: p.get("q") ?? undefined,
        payer: p.get("payer") ?? undefined,
        network: p.get("network") ?? undefined,
        code: RATE_ROW_CODES.includes(code as RateRowCode) ? (code as RateRowCode) : undefined,
        limit: num(p.get("limit"), 50),
        offset: num(p.get("offset"), 0),
      }),
      rateRowFacets(),
    ]);

    return NextResponse.json({ rows, total, facets });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

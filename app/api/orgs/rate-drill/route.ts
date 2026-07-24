import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getOrgPayerRateDrill } from "@/lib/repos/org-graph";

export const dynamic = "force-dynamic";

// The org map's rate drill — the distinct published rates behind one
// "N rates" chip, with plan attribution. Public MRF data, no logEvent.

/** GET /api/orgs/rate-drill?tin=ein:…&payer=…&code=90837 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const p = req.nextUrl.searchParams;
    const tin = (p.get("tin") ?? "").trim();
    const payer = (p.get("payer") ?? "").trim();
    const code = (p.get("code") ?? "").trim();
    if (!tin || !payer || !code) {
      return NextResponse.json({ error: "tin, payer and code are required." }, { status: 400 });
    }
    const rows = await getOrgPayerRateDrill(tin, payer, code);
    return NextResponse.json({ rows });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("orgs/rate-drill", e);
    return NextResponse.json({ error: "Rate drill failed." }, { status: 500 });
  }
}

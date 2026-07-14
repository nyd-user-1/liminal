import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { listOrgs } from "@/lib/repos/orgs";

export const dynamic = "force-dynamic";

// Organization search for the /orgs index (NYS-41). Payer-published public
// record (MRF TINs + NPPES), not PHI — no logEvent, mirroring the
// /api/directory + /api/rates convention.

/** GET /api/orgs?q=headway&limit=50 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim();
    const limit = Number(sp.get("limit") ?? 50);
    const namedParam = sp.get("named"); // "1" | "0" | null
    const kind = sp.get("kind");
    const orgs = await listOrgs({
      q,
      limit: Number.isFinite(limit) ? limit : 50,
      named: namedParam === "1" ? true : namedParam === "0" ? false : undefined,
      payer: sp.get("payer") || undefined,
      tinKind: kind === "ein" || kind === "npi" ? kind : undefined,
    });
    return NextResponse.json({ orgs });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("orgs", e);
    return NextResponse.json({ error: "Organization search failed." }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { PhotonError, hasPhoton, searchPhotonTreatments } from "@/lib/photon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/photon/treatments?q= — Photon's medication search, for adding to the
 * org catalog. Reference data, not PHI: no audit, nothing patient-specific.
 *
 * Backed by `medications(filter: { drug: { name } })`, NOT the documented
 * `medicationConcepts(name:)` — the latter returns null for every term in this
 * tenant (see docs/reports/2026-07-15-photon-phase2.md).
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    if (!hasPhoton) {
      return NextResponse.json({ error: "Photon is not configured on this server." }, { status: 503 });
    }
    const q = req.nextUrl.searchParams.get("q") ?? "";
    if (q.trim().length < 2) return NextResponse.json({ treatments: [] });
    const treatments = await searchPhotonTreatments(q);
    return NextResponse.json({ treatments });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof PhotonError) return NextResponse.json({ error: e.message, stage: e.stage }, { status: 502 });
    throw e;
  }
}

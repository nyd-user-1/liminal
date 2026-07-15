import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { PhotonError, hasPhoton, photonRxCounts } from "@/lib/photon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cap the ids one request can ask for. The clients list sends the visible page
// in a single call; anything larger is a caller bug, not a page.
const MAX_IDS = 200;

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/**
 * GET /api/photon/rx-counts?patientIds=a,b,c — prescription counts for the
 * visible page of the clients list in ONE round-trip from the browser
 * (server-side these batch into aliased GraphQL queries, 60s cached).
 *
 * Returns { counts: { [photonPatientId]: number } }. No PHI in, no PHI out —
 * Photon ids and integers only, so this isn't audited as a PHI read.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    if (!hasPhoton) {
      return NextResponse.json({ error: "Photon is not configured on this server." }, { status: 503 });
    }
    const raw = req.nextUrl.searchParams.get("patientIds") ?? "";
    const patientIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!patientIds.length) return NextResponse.json({ counts: {} });
    if (patientIds.length > MAX_IDS) {
      return NextResponse.json({ error: `Too many patientIds (max ${MAX_IDS}).` }, { status: 400 });
    }
    const counts = await photonRxCounts(patientIds);
    return NextResponse.json({ counts });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    if (e instanceof PhotonError) {
      return NextResponse.json({ error: e.message, stage: e.stage }, { status: 502 });
    }
    throw e;
  }
}

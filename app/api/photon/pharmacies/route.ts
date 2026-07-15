import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { PhotonError, hasPhoton, searchPhotonPharmacies } from "@/lib/photon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/photon/pharmacies?name=&lat=&lng=&radius=&type= — pharmacy search.
 *
 * Photon's pharmacy directory is public reference data, not PHI: any signed-in
 * user may search it, and nothing is audited or logged.
 *
 * `lat`/`lng` are required for a PICK_UP search — Photon rejects a name-only
 * query with "Missing location for search on pharmacy of type PICK_UP", and its
 * LatLongSearch takes coordinates only (no postal-code search, no geocoder).
 * MAIL_ORDER needs no location at all.
 */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    if (!hasPhoton) {
      return NextResponse.json({ error: "Photon is not configured on this server." }, { status: 503 });
    }
    const q = req.nextUrl.searchParams;
    const type = q.get("type") === "MAIL_ORDER" ? "MAIL_ORDER" : "PICK_UP";
    // Presence first: Number(null) is 0, which is finite — checking only
    // Number.isFinite would read a MISSING coordinate as a valid 0,0 and send
    // the search into the Gulf of Guinea.
    const latRaw = q.get("lat");
    const lngRaw = q.get("lng");
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    const hasLocation = latRaw !== null && lngRaw !== null && Number.isFinite(lat) && Number.isFinite(lng);

    if (type === "PICK_UP" && !hasLocation) {
      return NextResponse.json({ error: "A location is required to search pick-up pharmacies." }, { status: 400 });
    }
    const radius = Number(q.get("radius"));
    const pharmacies = await searchPhotonPharmacies({
      name: q.get("name"),
      type,
      location: type === "PICK_UP" ? { latitude: lat, longitude: lng, radius: Number.isFinite(radius) ? radius : 10 } : null,
      first: 10,
    });
    return NextResponse.json({ pharmacies });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof PhotonError) return NextResponse.json({ error: e.message, stage: e.stage }, { status: 502 });
    throw e;
  }
}

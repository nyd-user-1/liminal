import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { PhotonError, hasPhoton, removePhotonPreferredPharmacy, setPhotonPreferredPharmacies } from "@/lib/photon";
import { clientForUser } from "@/lib/repos/threads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The portal client's own preferred pharmacy. Deliberately NOT `routeOrder`:
// routing an order to a pharmacy is a one-way door, while a preferred pharmacy
// can be set and unset freely, and Photon does not auto-route an order in
// ROUTING when one is set. See docs/reports/2026-07-15-photon-phase2.md.
//
// Client-role only, and the patient id comes from the SESSION (clients.user_id
// → photon_patient_id), never from the request body — there is no id here a
// caller could point at someone else.

async function ownPatientId(userId: string): Promise<string> {
  const client = await clientForUser(userId);
  if (!client?.photonPatientId) throw new AuthError("Your record is not connected to a pharmacy account yet.", 403);
  return client.photonPatientId;
}

function fail(e: unknown): NextResponse {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof PhotonError) return NextResponse.json({ error: e.message, stage: e.stage }, { status: 502 });
  throw e;
}

/** POST { pharmacyId } — set it as the client's preferred pharmacy. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("client");
    if (!hasPhoton) return NextResponse.json({ error: "Photon is not configured on this server." }, { status: 503 });
    const patientId = await ownPatientId(user.id);
    const { pharmacyId } = (await req.json()) as { pharmacyId?: string };
    if (!pharmacyId) return NextResponse.json({ error: "pharmacyId is required." }, { status: 400 });

    // One preferred pharmacy is the portal's model — the field is a list, so
    // setting replaces rather than appends.
    const pharmacies = await setPhotonPreferredPharmacies(patientId, [pharmacyId]);
    await logEvent({
      actorId: user.id,
      action: "photon.pharmacy.prefer",
      entity: "client",
      meta: { pharmacyId },
    });
    return NextResponse.json({ pharmacies });
  } catch (e) {
    return fail(e);
  }
}

/** DELETE ?pharmacyId= — drop it from the client's preferred pharmacies. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole("client");
    if (!hasPhoton) return NextResponse.json({ error: "Photon is not configured on this server." }, { status: 503 });
    const patientId = await ownPatientId(user.id);
    const pharmacyId = req.nextUrl.searchParams.get("pharmacyId");
    if (!pharmacyId) return NextResponse.json({ error: "pharmacyId is required." }, { status: 400 });

    const pharmacies = await removePhotonPreferredPharmacy(patientId, pharmacyId);
    await logEvent({
      actorId: user.id,
      action: "photon.pharmacy.unprefer",
      entity: "client",
      meta: { pharmacyId },
    });
    return NextResponse.json({ pharmacies });
  } catch (e) {
    return fail(e);
  }
}

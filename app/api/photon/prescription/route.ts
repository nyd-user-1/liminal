import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { PhotonError, getPhotonPrescription, hasPhoton } from "@/lib/photon";
import { assertPhotonPatientVisible } from "@/lib/photon-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/photon/prescription?id= — one prescription plus the orders reached
 * through its fills (PHI read, audited).
 *
 * Open to any signed-in role, but narrowed after the fetch: Photon answers for
 * any patient in the org, so the row's OWN patient id is checked against what
 * this user may see (portal client → themselves, practitioner → their caseload,
 * admin → all). That ordering is deliberate — we can't know whose row it is
 * until we've read it, so the check gates the RESPONSE, not the query.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!hasPhoton) {
      return NextResponse.json({ error: "Photon is not configured on this server." }, { status: 503 });
    }
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const prescription = await getPhotonPrescription(id);
    if (!prescription) return NextResponse.json({ error: "Prescription not found." }, { status: 404 });

    const client = await assertPhotonPatientVisible(user, prescription.patientId);

    await logEvent({
      actorId: user.id,
      action: "photon.prescription.read",
      entity: "client",
      entityId: client.id,
      meta: { prescriptionId: id, orders: prescription.orders.length },
    });
    return NextResponse.json({ prescription });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof PhotonError) return NextResponse.json({ error: e.message, stage: e.stage }, { status: 502 });
    throw e;
  }
}

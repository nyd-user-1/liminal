import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { PhotonError, hasPhoton, listPhotonPrescriptions } from "@/lib/photon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/** GET /api/photon/prescriptions?patientId= — normalized Rx list (PHI read, audited). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    if (!hasPhoton) {
      return NextResponse.json({ error: "Photon is not configured on this server." }, { status: 503 });
    }
    const patientId = req.nextUrl.searchParams.get("patientId");
    if (!patientId) return NextResponse.json({ error: "patientId is required." }, { status: 400 });

    const prescriptions = await listPhotonPrescriptions(patientId);
    await logEvent({
      actorId: user.id,
      action: "photon.prescription.list",
      entity: "client",
      meta: { photonPatientId: patientId, count: prescriptions.length },
    });
    return NextResponse.json({ prescriptions });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    if (e instanceof PhotonError) {
      return NextResponse.json({ error: e.message, stage: e.stage }, { status: 502 });
    }
    throw e;
  }
}

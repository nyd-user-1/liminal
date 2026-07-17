import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { PHOTON_LIST_LIMIT, PhotonError, hasPhoton, listAllPhotonOrders } from "@/lib/photon";
import { photonVisibleClients } from "@/lib/photon-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/**
 * GET /api/photon/orders/all — the ORG-WIDE pharmacy order list, role-scoped,
 * with clientId + patientName mapped in. The client-callable twin of the
 * /orders server page (same scoping rule, same shape), so the Clients rail can
 * lazy-load orders into a tab without loading them up front. PHI read, audited.
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    if (!hasPhoton) {
      return NextResponse.json({ error: "Photon is not configured on this server." }, { status: 503 });
    }

    const [all, visible] = await Promise.all([listAllPhotonOrders(), photonVisibleClients(user)]);
    const rows = all
      .filter((o) => visible.has(o.patientId))
      .map((o) => {
        const client = visible.get(o.patientId)!;
        return { ...o, clientId: client.id, patientName: `${client.firstName} ${client.lastName}` };
      });

    await logEvent({
      actorId: user.id,
      action: "photon.order.list",
      entity: "client",
      meta: { count: rows.length, scope: user.role === "admin" ? "all" : "own" },
    });
    // truncated reflects the RAW list hitting the per-query cap, not the
    // role-filtered subset — same signal the /orders page shows.
    return NextResponse.json({ orders: rows, truncated: all.length >= PHOTON_LIST_LIMIT });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    if (e instanceof PhotonError) {
      return NextResponse.json({ error: e.message, stage: e.stage }, { status: 502 });
    }
    throw e;
  }
}

import { EmptyState } from "@/components/ui/empty-state";
import { logEvent } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { PHOTON_LIST_LIMIT, hasPhoton, listAllPhotonOrders } from "@/lib/photon";
import { photonVisibleClients } from "@/lib/photon-scope";
import { OrdersIndex } from "./orders-index";

// Pharmacy orders, org-wide, scoped to the viewer's caseload the same way
// /prescriptions and the clients list are.

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requireRole("practitioner");
  if (!hasPhoton) {
    return (
      <EmptyState
        icon="send"
        title="Photon is not configured"
        subtext="Set the PHOTON_* environment variables to read pharmacy orders."
      />
    );
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

  return <OrdersIndex rows={rows} truncated={all.length >= PHOTON_LIST_LIMIT} />;
}

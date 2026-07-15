import { EmptyState } from "@/components/ui/empty-state";
import { logEvent } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { PHOTON_LIST_LIMIT, hasPhoton, listAllPhotonPrescriptions } from "@/lib/photon";
import { photonVisibleClients } from "@/lib/photon-scope";
import { PrescriptionsIndex } from "./prescriptions-index";

// Org-wide prescriptions. Photon answers org-wide for an M2M token, so the
// role narrowing is ours: an admin sees every row, a practitioner only their
// own caseload's (lib/photon-scope.ts, same rule as the clients list).

export const dynamic = "force-dynamic";

export default async function PrescriptionsPage() {
  const user = await requireRole("practitioner");
  if (!hasPhoton) {
    return (
      <EmptyState
        icon="pill-bottle"
        title="Photon is not configured"
        subtext="Set the PHOTON_* environment variables to read prescriptions."
      />
    );
  }

  const [all, visible] = await Promise.all([listAllPhotonPrescriptions(), photonVisibleClients(user)]);
  const rows = all
    .filter((rx) => visible.has(rx.patientId))
    .map((rx) => {
      const client = visible.get(rx.patientId)!;
      return { ...rx, clientId: client.id, patientName: `${client.firstName} ${client.lastName}` };
    });

  await logEvent({
    actorId: user.id,
    action: "photon.prescription.list",
    entity: "client",
    meta: { count: rows.length, scope: user.role === "admin" ? "all" : "own" },
  });

  return <PrescriptionsIndex rows={rows} truncated={all.length >= PHOTON_LIST_LIMIT} />;
}

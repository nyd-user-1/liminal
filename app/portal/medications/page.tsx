import { EmptyState } from "@/components/ui/empty-state";
import { logEvent } from "@/lib/audit";
import { hasPhoton, getPhotonPreferredPharmacies, listPhotonPatientOrders, listPhotonPrescriptions } from "@/lib/photon";
import { requirePortalClient } from "../data";
import { MedicationsList } from "./medications-list";

// Portal Medications — the client's own prescriptions, their pharmacy orders
// and their preferred pharmacy, all read through the server's M2M token.
//
// Scoping is structural rather than a filter: the Photon patient id comes from
// THIS session's client row (clients.user_id → photon_patient_id), so the page
// can only ever ask Photon about the signed-in patient.

export const dynamic = "force-dynamic";

export default async function PortalMedicationsPage() {
  const { user, client } = await requirePortalClient();
  if (!client) {
    return <EmptyState icon="pill-bottle" title="No client record is linked to this login" />;
  }
  if (!hasPhoton || !client.photonPatientId) {
    return (
      <EmptyState
        icon="pill-bottle"
        title="No medications yet"
        subtext="Prescriptions your care team writes for you will appear here."
      />
    );
  }

  const patientId = client.photonPatientId;
  const [prescriptions, orders, preferred] = await Promise.all([
    listPhotonPrescriptions(patientId),
    listPhotonPatientOrders(patientId),
    getPhotonPreferredPharmacies(patientId),
  ]);
  await logEvent({
    actorId: user.id,
    action: "portal.medications.view",
    entity: "client",
    entityId: client.id,
    meta: { prescriptions: prescriptions.length, orders: orders.length },
  });

  return <MedicationsList prescriptions={prescriptions} orders={orders} preferred={preferred} />;
}

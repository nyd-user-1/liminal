import { AuthError, type SessionUser } from "@/lib/auth";
import { listClients } from "@/lib/repos/clients";
import { clientForUser } from "@/lib/repos/threads";
import type { Client } from "@/lib/types";

// Who may see which Photon rows. Photon's own queries are org-scoped — an M2M
// token sees every patient in the organization — so the per-role narrowing is
// OURS to do, keyed on the clients table rather than on anything in Photon.
// Same rule the clients list already uses (app/(app)/clients/page.tsx): admin
// sees all, a practitioner sees their own caseload, a portal client sees only
// themselves. No new auth concepts.

/**
 * Clients the signed-in user may see Photon data for, keyed by Photon patient
 * id. Clients that were never synced carry no key and simply can't appear.
 */
export async function photonVisibleClients(user: SessionUser): Promise<Map<string, Client>> {
  if (user.role === "client") {
    const own = await clientForUser(user.id);
    return new Map(own?.photonPatientId ? [[own.photonPatientId, own]] : []);
  }
  const clients = await listClients(user.role === "admin" ? undefined : { practitionerId: user.id });
  return new Map(
    clients.filter((c): c is Client & { photonPatientId: string } => !!c.photonPatientId).map((c) => [c.photonPatientId, c]),
  );
}

/**
 * Guard for a single Photon patient id: returns the matching client or throws
 * 403. Used by the by-id endpoints, where the id arrives from the browser and
 * Photon would happily answer for any patient in the org.
 */
export async function assertPhotonPatientVisible(user: SessionUser, patientId: string): Promise<Client> {
  const visible = await photonVisibleClients(user);
  const client = visible.get(patientId);
  if (!client) throw new AuthError("You do not have access to this patient's prescriptions.", 403);
  return client;
}

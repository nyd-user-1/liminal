import { getUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { listClients, listPractitioners } from "@/lib/repos/clients";
import { ClientsIndex } from "./clients-index";

// Clients index — server component loads the full list; searching, filtering
// and pagination happen client-side in ClientsIndex (demo-scale dataset).
//
// Role-aware: the practice admin sees every client plus whose caseload each one
// sits in; a practitioner sees only their own. Role comes off the session —
// same guard the rest of the app uses, no new auth concepts.

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const user = await getUser();
  const isAdmin = user?.role === "admin";
  const [clients, practitioners] = await Promise.all([
    listClients(isAdmin ? undefined : { practitionerId: user?.id }),
    listPractitioners(),
  ]);
  await logEvent({
    actorId: user?.id ?? null,
    action: "client.list",
    entity: "client",
    meta: { count: clients.length, scope: isAdmin ? "all" : "own" },
  });
  return <ClientsIndex clients={clients} practitioners={practitioners} isAdmin={isAdmin} />;
}

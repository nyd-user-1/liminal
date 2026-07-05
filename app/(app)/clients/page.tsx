import { getUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { listClients, listPractitioners } from "@/lib/repos/clients";
import { ClientsIndex } from "./clients-index";

// Clients index — server component loads the full list; searching, filtering
// and pagination happen client-side in ClientsIndex (demo-scale dataset).

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const user = await getUser();
  const [clients, practitioners] = await Promise.all([listClients(), listPractitioners()]);
  await logEvent({
    actorId: user?.id ?? null,
    action: "client.list",
    entity: "client",
    meta: { count: clients.length },
  });
  return <ClientsIndex clients={clients} practitioners={practitioners} />;
}

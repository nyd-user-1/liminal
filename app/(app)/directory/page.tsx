import { requireRole } from "@/lib/auth";
import { listClients } from "@/lib/repos/clients";
import { providerFacets } from "@/lib/repos/directory";
import { DirectoryClient } from "./directory-client";

// Referral Directory — searchable view over the NY open-data provider and
// program tables, with a "Refer a client" action. Server component loads the
// filter facets + client picker options; the table pages server-side via the
// /api/directory/* routes.

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  await requireRole("practitioner");
  const [pf, clients] = await Promise.all([providerFacets(), listClients()]);
  return (
    <DirectoryClient
      providerFacets={pf}
      clients={clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
    />
  );
}

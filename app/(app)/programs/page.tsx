import { requireRole } from "@/lib/auth";
import { listClients } from "@/lib/repos/clients";
import { programFacets } from "@/lib/repos/directory";
import { ProgramsClient } from "./programs-client";

// /programs — the NY OMH mental-health program directory, split out of
// /directory (founder cut 2026-07-23). Server component loads the facets +
// client picker options; the table pages server-side via /api/directory/programs.

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  await requireRole("practitioner");
  const [facets, clients] = await Promise.all([programFacets(), listClients()]);
  return (
    <ProgramsClient
      facets={facets}
      clients={clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
    />
  );
}

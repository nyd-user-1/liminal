import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { listClients } from "@/lib/repos/clients";
import { getProviderByNpi } from "@/lib/repos/directory";
import { networkSummaryForNpi } from "@/lib/repos/networks";
import { ProviderProfile } from "./provider-profile";

// Directory provider profile — replaces the Directory table's SidePanel for
// rows that carry an NPI (see directory-client.tsx's openProvider). Thin
// server page per this repo's convention (see clients/[id]/page.tsx); real
// content in the client component below.

export const dynamic = "force-dynamic";

export default async function ProviderProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ npi: string }>;
  searchParams: Promise<{ refer?: string }>;
}) {
  await requireRole("practitioner");
  const { npi } = await params;
  if (!/^\d{10}$/.test(npi)) notFound();
  const { refer } = await searchParams;

  const [provider, network, clients] = await Promise.all([
    getProviderByNpi(npi),
    networkSummaryForNpi(npi),
    listClients(),
  ]);
  if (!provider) notFound();

  return (
    <ProviderProfile
      provider={provider}
      network={network}
      clients={clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
      openRefer={refer === "1"}
    />
  );
}

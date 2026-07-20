import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { listAppointments } from "@/lib/repos/appointments";
import { getClient, listClients, listPractitioners } from "@/lib/repos/clients";
import { listReferrals } from "@/lib/repos/directory";
import { fileAccessHistory, listFiles } from "@/lib/repos/files";
import { clientBillingSummary, listInvoices } from "@/lib/repos/invoices";
import { listPayers, listPolicies } from "@/lib/repos/policies";
import { listServices } from "@/lib/repos/services";
import { hasPhoton, photonOrgId } from "@/lib/photon";
import type { ClientRecordBundle } from "@/components/records/client-record";
import { ClientsIndex } from "../clients-index";

// A client record is a TAB in the Clients rail, not a page of its own — so this
// route renders the rail with that client already open, which is how /directory
// resolves a provider. The URL keeps working (bookmarks, the portal's links,
// every ?tab=rx reference in the app); it just isn't where the record lives.
//
// The bundle is server-fetched here and handed to the tab as its starting
// state, so a bookmarked record paints with data rather than a spinner. A row
// click in the rail takes the other path — the twin at /api/clients/[id]/record.

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const client = await getClient(id);
  if (!client) notFound();

  const user = await getUser();
  const isAdmin = user?.role === "admin";
  const [clients, practitioners, policies, payers, files, appointments, invoices, referrals, billingSummary, services] =
    await Promise.all([
      listClients(isAdmin ? undefined : { practitionerId: user?.id }),
      listPractitioners(),
      listPolicies(id),
      listPayers(),
      listFiles(id),
      listAppointments({ clientId: id }),
      listInvoices({ clientId: id }),
      listReferrals({ clientId: id }),
      clientBillingSummary(id),
      listServices(),
    ]);
  await logEvent({ actorId: user?.id ?? null, action: "client.view", entity: "client", entityId: id });

  // Needs the file ids, so it follows the batch rather than joining it.
  const fileAccess = await fileAccessHistory(files.map((f) => f.id));

  // Photon's org id rides on the M2M token, so it follows the credentials from
  // sandbox to production instead of needing its own env var. A Photon outage
  // must not take the whole client record down — the Rx card degrades alone.
  const orgId = hasPhoton ? await photonOrgId().catch(() => "") : "";

  const record: ClientRecordBundle = {
    client,
    practitioners,
    practitionerName: practitioners.find((p) => p.id === client.primaryPractitionerId)?.name ?? null,
    policies,
    payers,
    files,
    fileAccess,
    appointments,
    invoices,
    referrals,
    billingSummary,
    services: services
      .filter((s) => s.active)
      .map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents })),
    orgId,
    photonClientId: process.env.NEXT_PUBLIC_PHOTON_CLIENT_ID ?? "",
    photonEnv: process.env.NEXT_PUBLIC_PHOTON_ENV ?? "",
  };

  return (
    <ClientsIndex
      clients={clients}
      practitioners={practitioners}
      isAdmin={isAdmin}
      initialRecord={record}
      initialCard={tab}
    />
  );
}

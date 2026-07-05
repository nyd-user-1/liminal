import { notFound } from "next/navigation";
import { ClientBilling } from "@/components/billing/client-billing";
import { ClientNotes } from "@/components/notes/client-notes";
import { getUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { listAppointments } from "@/lib/repos/appointments";
import { getClient, listPractitioners } from "@/lib/repos/clients";
import { listFiles } from "@/lib/repos/files";
import { listInvoices } from "@/lib/repos/invoices";
import { listPayers, listPolicies } from "@/lib/repos/policies";
import { ClientHeader } from "./client-header";
import { ClientTabs } from "./client-tabs";
import { FilesTab } from "./files-tab";
import { InsuranceTab } from "./insurance-tab";
import { OverviewTab } from "./overview-tab";
import { PersonalTab } from "./personal-tab";

// Client record — Breadcrumb → Avatar + name + status Badge header over
// Tabs. All tab content renders server-side here and is slotted into the
// client-side ClientTabs switcher.

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
  const [practitioners, policies, payers, files, appointments, invoices] = await Promise.all([
    listPractitioners(),
    listPolicies(id),
    listPayers(),
    listFiles(id),
    listAppointments({ clientId: id }),
    listInvoices({ clientId: id }),
  ]);
  await logEvent({ actorId: user?.id ?? null, action: "client.view", entity: "client", entityId: id });

  const practitionerName = practitioners.find((p) => p.id === client.primaryPractitionerId)?.name ?? null;

  return (
    <>
      <ClientHeader client={client} />
      <ClientTabs
        initialTab={tab}
        tabs={[
          {
            key: "overview",
            label: "Overview",
            content: (
              <OverviewTab
                client={client}
                appointments={appointments}
                invoices={invoices}
                practitionerName={practitionerName}
              />
            ),
          },
          {
            key: "personal",
            label: "Personal",
            content: <PersonalTab client={client} practitioners={practitioners} />,
          },
          {
            key: "insurance",
            label: "Insurance",
            count: policies.length,
            content: <InsuranceTab clientId={client.id} policies={policies} payers={payers} files={files} />,
          },
          {
            key: "documentation",
            label: "Documentation",
            content: <ClientNotes clientId={client.id} />,
          },
          {
            key: "billing",
            label: "Billing",
            content: <ClientBilling clientId={client.id} />,
          },
          {
            key: "files",
            label: "Files",
            count: files.length,
            content: <FilesTab clientId={client.id} files={files} />,
          },
        ]}
      />
    </>
  );
}

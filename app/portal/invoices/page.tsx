import { EmptyState } from "@/components/ui/empty-state";
import { listInvoices } from "@/lib/repos/invoices";
import { requirePortalClient } from "../data";
import { InvoicesList } from "./invoices-list";

// Portal Invoices — the client's invoices with a Pay action (Stripe
// checkout; mock flow when no key is configured).

export const dynamic = "force-dynamic";

export default async function PortalInvoicesPage() {
  const { client } = await requirePortalClient();
  if (!client) {
    return (
      <>
        <EmptyState icon="credit-card" title="No client record is linked to this login" />
      </>
    );
  }

  const invoices = (await listInvoices({ clientId: client.id })).filter((i) => i.status !== "draft");

  return (
    <>
      <InvoicesList
        invoices={invoices.map((i) => ({
          id: i.id,
          number: i.number,
          status: i.status,
          issuedOn: i.issuedOn,
          dueOn: i.dueOn,
          totalCents: i.totalCents,
          balanceCents: i.balanceCents,
        }))}
      />
    </>
  );
}

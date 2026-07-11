import { EmptyState } from "@/components/ui/empty-state";
import { getInvoice, listInvoices } from "@/lib/repos/invoices";
import { hasStripe } from "@/lib/stripe";
import { requirePortalClient } from "../data";
import { InvoicesList } from "./invoices-list";

// Portal Invoices — the client's invoices, each opening a self-contained
// detail + pay sheet (bottom sheet on phones, side panel on desktop).
// Details are hydrated here so sheets open instantly; drafts stay hidden
// until the practice sends them.

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

  const summaries = (await listInvoices({ clientId: client.id })).filter((i) => i.status !== "draft");
  const details = (await Promise.all(summaries.map((s) => getInvoice(s.id)))).filter((d) => d !== null);

  return (
    <InvoicesList
      stripeLive={hasStripe()}
      clientEmail={client.email ?? null}
      invoices={details.map((d) => ({
        id: d.id,
        number: d.number,
        status: d.status,
        issuedOn: d.issuedOn,
        dueOn: d.dueOn,
        subtotalCents: d.subtotalCents,
        taxCents: d.taxCents,
        totalCents: d.totalCents,
        paidCents: d.paidCents,
        balanceCents: d.balanceCents,
        items: d.items.map(({ id, description, qty, unitCents, amountCents }) => ({
          id,
          description,
          qty,
          unitCents,
          amountCents,
        })),
        payments: d.payments.map(({ id, method, amountCents, paidAt }) => ({ id, method, amountCents, paidAt })),
      }))}
    />
  );
}

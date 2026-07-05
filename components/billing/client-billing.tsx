import { ClientInvoices } from "@/components/billing/client-invoices";
import { clientBillingSummary, listInvoices } from "@/lib/repos/invoices";
import { listServices } from "@/lib/repos/services";

// Client Billing tab (Clients-agent contract) — async server component:
// loads this client's invoices + billing summary + service options, then
// hands off to the interactive ClientInvoices view.

export async function ClientBilling({ clientId }: { clientId: string }) {
  const [invoices, summary, services] = await Promise.all([
    listInvoices({ clientId }),
    clientBillingSummary(clientId),
    listServices(),
  ]);
  return (
    <ClientInvoices
      clientId={clientId}
      invoices={invoices}
      summary={summary}
      services={services
        .filter((s) => s.active)
        .map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents }))}
    />
  );
}

import { BillingDashboard } from "@/components/billing/billing-dashboard";
import { logEvent } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { invoiceStats, listClientOptions, listInvoices } from "@/lib/repos/invoices";
import { listPayers } from "@/lib/repos/payers";
import { listServices } from "@/lib/repos/services";

// Billing dashboard — server component loads invoices + stats + payers (and
// the client/service options the New-invoice panel needs); tabs, search,
// filters and row actions live client-side in BillingDashboard.

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getUser();
  const [invoices, stats, payers, clients, services] = await Promise.all([
    listInvoices(),
    invoiceStats(),
    listPayers(),
    listClientOptions(),
    listServices(),
  ]);
  await logEvent({
    actorId: user?.id ?? null,
    action: "invoice.list",
    entity: "invoice",
    meta: { count: invoices.length },
  });
  return (
    <BillingDashboard
      invoices={invoices}
      stats={stats}
      payers={payers}
      clients={clients}
      services={services
        .filter((s) => s.active)
        .map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents }))}
    />
  );
}

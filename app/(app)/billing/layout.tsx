import { BillingShell } from "@/components/billing/billing-shell";
import { logEvent } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { invoiceStats, listClientOptions, listInvoices } from "@/lib/repos/invoices";
import { listPayers } from "@/lib/repos/payers";
import { listServices } from "@/lib/repos/services";

// Billing segment layout — owns the invoice-list pane so /billing and
// /billing/[id] share one inbox-style split view; pages render into the
// right pane. Also loads the payers + client/service options the in-pane
// panels (New invoice, Payers) need.

export const dynamic = "force-dynamic";

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
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
    <BillingShell
      invoices={invoices}
      stats={stats}
      payers={payers}
      clients={clients}
      services={services
        .filter((s) => s.active)
        .map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents }))}
    >
      {children}
    </BillingShell>
  );
}

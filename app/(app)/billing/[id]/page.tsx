import { notFound } from "next/navigation";
import { InvoiceDetailView } from "@/components/billing/invoice-detail";
import { logEvent } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { getInvoice } from "@/lib/repos/invoices";
import { hasStripe } from "@/lib/stripe";

// Invoice detail — server component loads the invoice (items + payments);
// actions live client-side in InvoiceDetailView. ?paid=1 / ?canceled=1 are
// set by the Stripe checkout redirect targets.

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; canceled?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const user = await getUser();
  await logEvent({ actorId: user?.id ?? null, action: "invoice.view", entity: "invoice", entityId: id });

  return (
    <InvoiceDetailView
      invoice={invoice}
      stripeConfigured={hasStripe()}
      justPaid={sp.paid === "1"}
      canceled={sp.canceled === "1"}
    />
  );
}

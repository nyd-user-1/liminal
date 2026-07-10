import { notFound } from "next/navigation";
import { InvoicePane } from "@/components/billing/invoice-pane";
import { TextLink } from "@/components/ui/text-link";
import { logEvent } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { getInvoice } from "@/lib/repos/invoices";
import { hasStripe } from "@/lib/stripe";

// Invoice detail — fills the right pane of the billing split view
// (billing/layout.tsx). Below lg it takes the whole screen, so it carries a
// back link to the list. ?paid=1 / ?canceled=1 are set by the Stripe
// checkout redirect targets.

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
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-2.5 lg:hidden">
        <TextLink href="/billing" icon="arrow-left">
          All invoices
        </TextLink>
      </div>
      <div className="min-h-0 flex-1">
        <InvoicePane
          invoice={invoice}
          stripeConfigured={hasStripe()}
          justPaid={sp.paid === "1"}
          canceled={sp.canceled === "1"}
        />
      </div>
    </div>
  );
}

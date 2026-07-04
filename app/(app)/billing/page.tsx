import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

// Placeholder — replaced by the Billing agent (task 9).
export default function BillingPage() {
  return (
    <>
      <PageHeader icon="dollar" title="Billing" className="mb-6" />
      <EmptyState icon="credit-card" title="No invoices yet" subtext="Invoices and payments will appear here." />
    </>
  );
}

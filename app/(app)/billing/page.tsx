import { AttentionTable } from "@/components/billing/attention-table";
import { EmptyState } from "@/components/ui/empty-state";
import { listInvoices } from "@/lib/repos/invoices";

// Right pane of the billing split view when no invoice is open — the
// invoices that need action next (the KPI strip lives above the split, in
// BillingShell). Below lg the list panel owns the screen, so this only
// renders on desktop.

export const dynamic = "force-dynamic";

const ATTENTION_ORDER: Record<string, number> = { overdue: 0, sent: 1, draft: 2 };

export default async function BillingPage() {
  const invoices = await listInvoices();
  const attention = invoices
    .filter((i) => i.status in ATTENTION_ORDER)
    .sort(
      (a, b) =>
        ATTENTION_ORDER[a.status] - ATTENTION_ORDER[b.status] ||
        (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"),
    )
    .slice(0, 8);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header band — same height as the list pane's header so their bottom
          borders meet in one line across the container */}
      <div className="flex h-[68px] shrink-0 items-center border-b border-border px-6">
        <h2 className="text-[17px] font-semibold text-text">Needs attention</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6 pr-7">
        {attention.length === 0 ? (
          <EmptyState icon="circle-check" title="All caught up" subtext="No open invoices need action right now." />
        ) : (
          <AttentionTable invoices={attention} />
        )}
      </div>
    </div>
  );
}

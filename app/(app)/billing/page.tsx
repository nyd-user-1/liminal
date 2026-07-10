import Link from "next/link";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { formatCents, formatDate } from "@/lib/format";
import { invoiceStats, listInvoices } from "@/lib/repos/invoices";

// Right pane of the billing split view when no invoice is open — a working
// overview: the practice's numbers plus the invoices that need action next.
// Below lg the list pane owns the screen, so this only renders on desktop.

export const dynamic = "force-dynamic";

const ATTENTION_ORDER: Record<string, number> = { overdue: 0, sent: 1, draft: 2 };

export default async function BillingPage() {
  const [stats, invoices] = await Promise.all([invoiceStats(), listInvoices()]);
  const attention = invoices
    .filter((i) => i.status in ATTENTION_ORDER)
    .sort(
      (a, b) =>
        ATTENTION_ORDER[a.status] - ATTENTION_ORDER[b.status] ||
        (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"),
    )
    .slice(0, 6);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Outstanding" value={formatCents(stats.outstandingCents)} />
        <StatCard label="Paid this month" value={formatCents(stats.paidThisMonthCents)} />
        <StatCard label="Overdue invoices" value={stats.overdueCount} />
        <StatCard label="Drafts" value={stats.draftCount} />
      </div>

      <h2 className="mb-3 mt-8 text-[19px] font-semibold text-text">Needs attention</h2>
      {attention.length === 0 ? (
        <EmptyState icon="circle-check" title="All caught up" subtext="No open invoices need action right now." />
      ) : (
        <div className="space-y-2">
          {attention.map((inv) => (
            <Link
              key={inv.id}
              href={`/billing/${inv.id}`}
              className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-canvas"
            >
              <Avatar name={inv.clientName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-text">{inv.clientName}</span>
                <span className="block truncate text-[13px] text-text-muted">
                  {inv.number}
                  {inv.dueOn ? ` · due ${formatDate(`${inv.dueOn}T00:00:00`)}` : ""}
                </span>
              </span>
              <InvoiceStatusBadge status={inv.status} />
              <span className="text-[15px] font-semibold text-text">{formatCents(inv.balanceCents)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

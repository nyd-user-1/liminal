"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AttentionTable } from "@/components/billing/attention-table";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { NewInvoicePanel, type ClientOption, type ServiceOption } from "@/components/billing/new-invoice-panel";
import { IndexHeader } from "@/components/ui/index-header";
import { PayerPanel } from "@/components/billing/payer-panel";
import { ChipMenu } from "@/components/rates/chip-menu";
import { Avatar } from "@/components/ui/avatar";
import { DotBadge } from "@/components/ui/badge";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { LoadMoreRow, SortableHead, Table, Td, Tr, useLazyBatch, useSort } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { Toolbar } from "@/components/ui/toolbar";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate } from "@/lib/format";
import type { InvoiceListItem, InvoiceStats } from "@/lib/repos/invoices";
import type { PayerListItem } from "@/lib/repos/payers";
import type { InvoiceStatus } from "@/lib/types";

// Billing — page-level Tabs (Overview/Clients/Payers) + standard tables. The
// invoice detail (/billing/[id]) is its own full-page view now — InvoicePane
// carries its own back button/header, so this shell renders nothing around
// it. New invoice/payer live in the TopBar; the biller never leaves /billing.

type ShellTab = "overview" | "clients" | "payers";
type InvoiceSortCol = "client" | "number" | "issued" | "due" | "status" | "balance";
type PayerSortCol = "code" | "name" | "policies";

const ATTENTION_ORDER: Record<string, number> = { overdue: 0, sent: 1, draft: 2 };
const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};
const STATUS_VARIANT: Record<InvoiceStatus, "neutral" | "info" | "success" | "danger"> = {
  draft: "neutral",
  sent: "info",
  paid: "success",
  overdue: "danger",
  void: "neutral",
};
const dateOnly = (d: string | null) => (d ? formatDate(`${d}T00:00:00`) : "—");

export function BillingShell({
  invoices,
  stats,
  payers,
  clients,
  services,
  children,
}: {
  invoices: InvoiceListItem[];
  stats: InvoiceStats;
  payers: PayerListItem[];
  clients: ClientOption[];
  services: ServiceOption[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  const activeId = pathname.startsWith("/billing/") ? pathname.split("/")[2] : null;

  const [tab, setTab] = useState<ShellTab>("overview");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | undefined>();
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [payerPanel, setPayerPanel] = useState<{ open: boolean; payer: PayerListItem | null }>({
    open: false,
    payer: null,
  });
  const [invoiceSort, toggleInvoiceSort] = useSort<InvoiceSortCol>({ col: "number", dir: "desc" });
  const [payerSort, togglePayerSort] = useSort<PayerSortCol>({ col: "name", dir: "asc" });

  const q = query.trim().toLowerCase();

  const attention = useMemo(
    () =>
      invoices
        .filter((i) => i.status in ATTENTION_ORDER)
        .sort(
          (a, b) =>
            ATTENTION_ORDER[a.status] - ATTENTION_ORDER[b.status] || (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"),
        )
        .slice(0, 8),
    [invoices],
  );

  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        (i) =>
          (!status || i.status === status) &&
          (!q || i.number.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q)),
      ),
    [invoices, status, q],
  );
  const sortedInvoices = useMemo(() => {
    const dir = invoiceSort.dir === "asc" ? 1 : -1;
    return [...filteredInvoices].sort((a, b) => {
      const primary =
        invoiceSort.col === "client"
          ? a.clientName.localeCompare(b.clientName)
          : invoiceSort.col === "issued"
            ? (a.issuedOn ?? "").localeCompare(b.issuedOn ?? "")
            : invoiceSort.col === "due"
              ? (a.dueOn ?? "").localeCompare(b.dueOn ?? "")
              : invoiceSort.col === "status"
                ? STATUS_LABELS[a.status].localeCompare(STATUS_LABELS[b.status])
                : invoiceSort.col === "balance"
                  ? a.balanceCents - b.balanceCents
                  : a.number.localeCompare(b.number);
      return primary * dir || a.number.localeCompare(b.number);
    });
  }, [filteredInvoices, invoiceSort]);
  const { visible: visibleInvoices, hasMore: invoicesHaveMore, sentinelRef: invoiceSentinel } = useLazyBatch(
    sortedInvoices,
    { resetKey: `${q}|${status}` },
  );

  const filteredPayers = useMemo(
    () => payers.filter((p) => !q || p.name.toLowerCase().includes(q) || p.payerCode.toLowerCase().includes(q)),
    [payers, q],
  );
  const sortedPayers = useMemo(() => {
    const dir = payerSort.dir === "asc" ? 1 : -1;
    return [...filteredPayers].sort((a, b) => {
      const primary =
        payerSort.col === "code"
          ? a.payerCode.localeCompare(b.payerCode)
          : payerSort.col === "policies"
            ? a.policyCount - b.policyCount
            : a.name.localeCompare(b.name);
      return primary * dir || a.name.localeCompare(b.name);
    });
  }, [filteredPayers, payerSort]);
  const { visible: visiblePayers, hasMore: payersHaveMore, sentinelRef: payerSentinel } = useLazyBatch(sortedPayers, {
    resetKey: q,
  });

  const deletePayer = async (p: PayerListItem) => {
    const res = await fetch(`/api/payers/${p.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "Could not delete the payer.", "danger");
      return;
    }
    toast(`${p.name} deleted`, "success");
    router.refresh();
  };

  // The invoice detail is a full-page view — InvoicePane owns its own back
  // button/header, so nothing else from this shell renders around it.
  if (activeId) {
    return <div className="flex h-full min-h-0 flex-col">{children}</div>;
  }

  const hasFilters = !!(q || status);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* New follows the tab — it creates whatever you are looking at. */}
      <IndexHeader
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "clients", label: "Clients", count: invoices.length },
          { key: "payers", label: "Payers", count: payers.length },
        ]}
        active={tab}
        onChange={(k) => setTab(k as ShellTab)}
        newLabel={tab === "payers" ? "New payer" : "New invoice"}
        onNew={() => (tab === "payers" ? setPayerPanel({ open: true, payer: null }) : setNewInvoiceOpen(true))}
      />

      {tab === "overview" ? (
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Outstanding" value={formatCents(stats.outstandingCents)} />
            <StatCard label="Paid this month" value={formatCents(stats.paidThisMonthCents)} />
            <StatCard label="Overdue invoices" value={stats.overdueCount} />
            <StatCard label="Drafts" value={stats.draftCount} />
          </div>
          <div>
            <h2 className="mb-3 text-[17px] font-semibold text-text">Needs attention</h2>
            {attention.length === 0 ? (
              <div className="rounded-card border border-border bg-surface shadow-card">
                <EmptyState icon="circle-check" title="All caught up" subtext="No open invoices need action right now." />
              </div>
            ) : (
              <AttentionTable invoices={attention} />
            )}
          </div>
        </div>
      ) : tab === "clients" ? (
        <>
          <Toolbar className="mb-4 shrink-0 md:mb-6">
            <SearchInput
              placeholder="Search invoices or clients"
              className="w-full max-w-md"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ChipMenu
              label="Status"
              options={(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((s) => ({
                value: s,
                label: STATUS_LABELS[s],
                lead: <DotBadge variant={STATUS_VARIANT[s]} />,
              }))}
              value={status}
              onSelect={(v) => setStatus(v as InvoiceStatus)}
              onClear={() => setStatus(undefined)}
            />
            {hasFilters && (
              <TextLink
                onClick={() => {
                  setQuery("");
                  setStatus(undefined);
                }}
              >
                Reset
              </TextLink>
            )}
          </Toolbar>

          {sortedInvoices.length === 0 ? (
            <div className="rounded-card border border-border bg-surface shadow-card">
              <EmptyState
                icon="credit-card"
                title={hasFilters ? "No invoices match" : "No invoices yet"}
                subtext={hasFilters ? "Try a different search or filter." : "Create an invoice to start collecting."}
              />
            </div>
          ) : (
            <Table
              className="min-h-0 flex-1"
              stickyHeader
              head={[
                <SortableHead key="client" label="Client" col="client" sort={invoiceSort} onSort={toggleInvoiceSort} />,
                <SortableHead key="number" label="Invoice #" col="number" sort={invoiceSort} onSort={toggleInvoiceSort} />,
                <SortableHead key="issued" label="Issued" col="issued" sort={invoiceSort} onSort={toggleInvoiceSort} />,
                <SortableHead key="due" label="Due" col="due" sort={invoiceSort} onSort={toggleInvoiceSort} />,
                <SortableHead key="status" label="Status" col="status" sort={invoiceSort} onSort={toggleInvoiceSort} />,
                <SortableHead key="balance" label="Balance" col="balance" sort={invoiceSort} onSort={toggleInvoiceSort} />,
              ]}
            >
              {visibleInvoices.map((inv) => (
                <Tr key={inv.id} onClick={() => router.push(`/billing/${inv.id}`)}>
                  <Td className="max-w-56">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={inv.clientName} size="sm" className="shrink-0" />
                      <span className="min-w-0 truncate font-medium text-text" title={inv.clientName}>
                        {inv.clientName}
                      </span>
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">{inv.number}</Td>
                  <Td className="whitespace-nowrap text-text-muted">{dateOnly(inv.issuedOn)}</Td>
                  <Td className={`whitespace-nowrap ${inv.status === "overdue" ? "font-medium text-danger" : "text-text-muted"}`}>
                    {dateOnly(inv.dueOn)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <InvoiceStatusBadge status={inv.status} />
                  </Td>
                  <Td className="whitespace-nowrap font-semibold">{formatCents(inv.balanceCents)}</Td>
                </Tr>
              ))}
              {invoicesHaveMore && <LoadMoreRow sentinelRef={invoiceSentinel} colSpan={6} />}
            </Table>
          )}
        </>
      ) : (
        <>
          <Toolbar className="mb-4 shrink-0 md:mb-6">
            <SearchInput
              placeholder="Search payers"
              className="w-full max-w-md"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Toolbar>

          {sortedPayers.length === 0 ? (
            <div className="rounded-card border border-border bg-surface shadow-card">
              <EmptyState
                icon="shield-plus"
                title={q ? "No payers match" : "No payers yet"}
                subtext={q ? undefined : "Add the insurance payers your practice bills."}
              />
            </div>
          ) : (
            <Table
              className="min-h-0 flex-1"
              stickyHeader
              head={[
                <SortableHead key="code" label="Code" col="code" sort={payerSort} onSort={togglePayerSort} />,
                <SortableHead key="name" label="Payer" col="name" sort={payerSort} onSort={togglePayerSort} />,
                <SortableHead key="policies" label="Policies" col="policies" sort={payerSort} onSort={togglePayerSort} />,
                "",
              ]}
            >
              {visiblePayers.map((p) => (
                // The row opens the panel the Edit kebab already opened — it
                // was the one list here you could not click into.
                <Tr key={p.id} onClick={() => setPayerPanel({ open: true, payer: p })}>
                  <Td className="whitespace-nowrap font-semibold">{p.payerCode}</Td>
                  <Td className="max-w-64 truncate" title={p.name}>{p.name}</Td>
                  <Td className="whitespace-nowrap">{p.policyCount}</Td>
                  <Td className="w-12" onClick={(e) => e.stopPropagation()}>
                    <KebabMenu label={`Actions for ${p.name}`}>
                      <MenuItem icon="edit" label="Edit" onClick={() => setPayerPanel({ open: true, payer: p })} />
                      <MenuItem icon="trash" danger label="Delete" onClick={() => deletePayer(p)} />
                    </KebabMenu>
                  </Td>
                </Tr>
              ))}
              {payersHaveMore && <LoadMoreRow sentinelRef={payerSentinel} colSpan={4} />}
            </Table>
          )}
        </>
      )}

      <NewInvoicePanel
        open={newInvoiceOpen}
        onClose={() => setNewInvoiceOpen(false)}
        clients={clients}
        services={services}
      />
      <PayerPanel
        open={payerPanel.open}
        onClose={() => setPayerPanel({ open: false, payer: null })}
        payer={payerPanel.payer}
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { NewInvoicePanel, type ClientOption, type ServiceOption } from "@/components/billing/new-invoice-panel";
import { PayerPanel } from "@/components/billing/payer-panel";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSquare } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { ListRow } from "@/components/ui/list-row";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate } from "@/lib/format";
import type { InvoiceListItem, InvoiceStats } from "@/lib/repos/invoices";
import type { PayerListItem } from "@/lib/repos/payers";

// Billing — master/detail split (the Inbox pattern): invoice list pane
// (Tabs Open/Settled/Payers, search, active highlight) beside the open
// invoice (children from billing/layout.tsx). Below lg the panes swap on
// navigation instead of sharing the row. New invoice lives in the TopBar
// and opens a SidePanel (bottom sheet on phones); payer management stays
// in-pane. The biller never leaves /billing.

type ShellTab = "open" | "settled" | "payers";

const isSettled = (s: InvoiceListItem["status"]) => s === "paid" || s === "void";

function invoiceMeta(inv: InvoiceListItem): { text: string; danger?: boolean } {
  const due = inv.dueOn ? `Due ${formatDate(`${inv.dueOn}T00:00:00`)}` : null;
  switch (inv.status) {
    case "draft":
      return { text: "Draft — not sent yet" };
    case "overdue":
      return { text: due ?? "Overdue", danger: true };
    case "sent":
      return { text: due ?? "Awaiting payment" };
    case "paid":
      return { text: "Paid in full" };
    default:
      return { text: "Void" };
  }
}

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

  const active = invoices.find((i) => i.id === activeId);
  const [tab, setTab] = useState<ShellTab>(active && isSettled(active.status) ? "settled" : "open");
  const [query, setQuery] = useState("");
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [payerPanel, setPayerPanel] = useState<{ open: boolean; payer: PayerListItem | null }>({
    open: false,
    payer: null,
  });

  const counts = useMemo(
    () => ({
      open: invoices.filter((i) => !isSettled(i.status)).length,
      settled: invoices.filter((i) => isSettled(i.status)).length,
    }),
    [invoices],
  );

  const q = query.trim().toLowerCase();
  const visibleInvoices =
    tab === "payers"
      ? []
      : invoices.filter(
          (i) =>
            (tab === "settled") === isSettled(i.status) &&
            (!q || i.number.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q)),
        );
  const visiblePayers = payers.filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.payerCode.toLowerCase().includes(q),
  );

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

  return (
    <>
      <TopBarActions>
        {tab === "payers" ? (
          <Button leftIcon="plus" onClick={() => setPayerPanel({ open: true, payer: null })}>
            New payer
          </Button>
        ) : (
          <Button leftIcon="plus" onClick={() => setNewInvoiceOpen(true)}>
            New invoice
          </Button>
        )}
      </TopBarActions>

      <div className="flex h-full min-h-0 overflow-hidden rounded-card border border-border bg-surface shadow-card">
        {/* Invoice list pane */}
        <div
          className={`flex w-full flex-col border-border lg:w-[380px] lg:shrink-0 lg:border-r ${
            activeId ? "max-lg:hidden" : ""
          }`}
        >
          <div className="shrink-0 space-y-3 border-b border-border p-3">
            {/* The overview pane is desktop-only, so surface the two numbers that matter on phones. */}
            <div className="grid grid-cols-2 gap-2 lg:hidden">
              <div className="rounded-field bg-canvas px-3 py-2">
                <p className="text-[12px] font-medium text-text-muted">Outstanding</p>
                <p className="text-[15px] font-semibold text-text">{formatCents(stats.outstandingCents)}</p>
              </div>
              <div className="rounded-field bg-canvas px-3 py-2">
                <p className="text-[12px] font-medium text-text-muted">Overdue</p>
                <p className={`text-[15px] font-semibold ${stats.overdueCount > 0 ? "text-danger" : "text-text"}`}>
                  {stats.overdueCount}
                </p>
              </div>
            </div>
            <Tabs
              items={[
                { key: "open", label: "Open", count: counts.open },
                { key: "settled", label: "Settled", count: counts.settled },
                { key: "payers", label: "Payers", count: payers.length },
              ]}
              active={tab}
              onChange={(k) => setTab(k as ShellTab)}
            />
            <SearchInput
              placeholder={tab === "payers" ? "Search payers" : "Search invoices or clients"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "payers" ? (
              visiblePayers.length === 0 ? (
                <EmptyState
                  icon="shield-plus"
                  title={q ? "No payers match" : "No payers yet"}
                  subtext={q ? undefined : "Add the insurance payers your practice bills."}
                  actions={
                    q ? undefined : (
                      <Button leftIcon="plus" onClick={() => setPayerPanel({ open: true, payer: null })}>
                        New payer
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="space-y-2 p-3">
                  {visiblePayers.map((p) => (
                    <ListRow
                      key={p.id}
                      leading={<IconSquare name="shield-plus" />}
                      title={
                        <>
                          <span className="font-semibold">{p.payerCode}</span> {p.name}
                        </>
                      }
                      meta={`${p.policyCount} ${p.policyCount === 1 ? "policy" : "policies"} on file`}
                      trailing={
                        <KebabMenu>
                          <MenuItem icon="edit" label="Edit" onClick={() => setPayerPanel({ open: true, payer: p })} />
                          <MenuItem icon="trash" danger label="Delete" onClick={() => deletePayer(p)} />
                        </KebabMenu>
                      }
                    />
                  ))}
                </div>
              )
            ) : visibleInvoices.length === 0 ? (
              <EmptyState
                icon="credit-card"
                title={q ? "No invoices match" : tab === "open" ? "No open invoices" : "No settled invoices"}
                subtext={
                  q
                    ? "Try a different search."
                    : tab === "open"
                      ? "Create an invoice to start collecting."
                      : "Paid and voided invoices land here."
                }
              />
            ) : (
              visibleInvoices.map((inv) => {
                const current = inv.id === activeId;
                const meta = invoiceMeta(inv);
                return (
                  <Link
                    key={inv.id}
                    href={`/billing/${inv.id}`}
                    aria-current={current ? "page" : undefined}
                    className={`block border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-canvas ${
                      current ? "bg-canvas" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Avatar name={inv.clientName} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text">
                        {inv.clientName}
                      </span>
                      <span className="shrink-0 text-[15px] font-semibold text-text">
                        {formatCents(isSettled(inv.status) ? inv.totalCents : inv.balanceCents)}
                      </span>
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-text-body">{inv.number}</span>
                      <InvoiceStatusBadge status={inv.status} />
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-[13px] ${
                        meta.danger ? "font-medium text-danger" : "text-text-muted"
                      }`}
                    >
                      {meta.text}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Invoice pane */}
        <div className={`min-w-0 flex-1 flex-col lg:flex ${activeId ? "flex" : "max-lg:hidden lg:flex"}`}>
          {children}
        </div>
      </div>

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
    </>
  );
}

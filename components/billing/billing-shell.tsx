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
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { Toolbar } from "@/components/ui/toolbar";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate } from "@/lib/format";
import type { InvoiceListItem, InvoiceStats } from "@/lib/repos/invoices";
import type { PayerListItem } from "@/lib/repos/payers";

// Billing — page-level Tabs (Overview/Open/Settled/Payers) and search (the
// clients/directory pattern) over one master/detail container: agenda-style
// invoice list pane beside the open invoice (children from
// billing/layout.tsx). Overview is the KPI tab; below lg the split panes
// swap on navigation. New invoice lives in the TopBar; the biller never
// leaves /billing.

type ShellTab = "overview" | "open" | "settled" | "payers";

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

  const railCount =
    tab === "payers"
      ? `${visiblePayers.length} ${visiblePayers.length === 1 ? "payer" : "payers"}`
      : `${visibleInvoices.length} ${visibleInvoices.length === 1 ? "invoice" : "invoices"}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBarActions>
        {tab === "payers" ? (
          <Button size="sm" leftIcon="plus" onClick={() => setPayerPanel({ open: true, payer: null })}>
            New payer
          </Button>
        ) : (
          <Button size="sm" leftIcon="plus" onClick={() => setNewInvoiceOpen(true)}>
            New invoice
          </Button>
        )}
      </TopBarActions>

      <Tabs
        className="mb-4 shrink-0"
        items={[
          { key: "overview", label: "Overview" },
          { key: "open", label: "Open", count: counts.open },
          { key: "settled", label: "Settled", count: counts.settled },
          { key: "payers", label: "Payers", count: payers.length },
        ]}
        active={tab}
        onChange={(k) => setTab(k as ShellTab)}
      />

      {tab === "overview" ? (
        // The KPI tab — practice numbers get their own home.
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Outstanding" value={formatCents(stats.outstandingCents)} />
            <StatCard label="Paid this month" value={formatCents(stats.paidThisMonthCents)} />
            <StatCard label="Overdue invoices" value={stats.overdueCount} />
            <StatCard label="Drafts" value={stats.draftCount} />
          </div>
        </div>
      ) : (
        <>
      <Toolbar className="mb-4 shrink-0">
        <SearchInput
          placeholder={tab === "payers" ? "Search payers" : "Search invoices or clients"}
          className="w-full max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Toolbar>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-card border border-border bg-surface shadow-card">
        {/* Invoice list pane — agenda-rail row treatment inside the split */}
        <aside
          className={`w-full flex-col border-border lg:flex lg:w-80 lg:shrink-0 lg:border-r ${
            activeId ? "hidden" : "flex"
          }`}
        >
          {/* Pane header — matches the right pane's header height so the two
              bottom borders meet in one horizontal line across the container */}
          <div className="flex h-[68px] shrink-0 items-center border-b border-border px-4">
            <h2 className="text-[17px] font-semibold text-text">{tab === "payers" ? "Payers" : "Invoices"}</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {tab === "payers" ? (
              visiblePayers.length === 0 ? (
                <EmptyState
                  icon="shield-plus"
                  title={q ? "No payers match" : "No payers yet"}
                  subtext={q ? undefined : "Add the insurance payers your practice bills."}
                />
              ) : (
                <div className="space-y-2 p-1">
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
              <div className="space-y-0.5">
                {visibleInvoices.map((inv) => {
                  const current = inv.id === activeId;
                  const meta = invoiceMeta(inv);
                  return (
                    <Link
                      key={inv.id}
                      href={`/billing/${inv.id}`}
                      aria-current={current ? "page" : undefined}
                      className={`block rounded-field px-2.5 py-2 transition-colors hover:bg-canvas ${
                        current ? "bg-canvas" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Avatar name={inv.clientName} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                          {inv.clientName}
                        </span>
                        <span className="shrink-0 text-[15px] font-semibold text-text">
                          {formatCents(isSettled(inv.status) ? inv.totalCents : inv.balanceCents)}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] text-text-muted">{inv.number}</span>
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
                })}
              </div>
            )}
          </div>
          {/* Pinned count, agenda-style */}
          <div className="shrink-0 border-t border-border px-4 py-3 text-[13px] font-medium text-text-muted">
            {railCount}
          </div>
        </aside>

        {/* Invoice pane */}
        <div className={`min-w-0 flex-1 flex-col lg:flex ${activeId ? "flex" : "hidden"}`}>{children}</div>
      </div>
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

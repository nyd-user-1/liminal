"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { NewInvoicePanel, type ClientOption, type ServiceOption } from "@/components/billing/new-invoice-panel";
import { PayerPanel } from "@/components/billing/payer-panel";
import { RecordPaymentModal, type PaymentTarget } from "@/components/billing/record-payment-modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Icon, IconSquare } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { ListRow } from "@/components/ui/list-row";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Td, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { Toolbar } from "@/components/ui/toolbar";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate } from "@/lib/format";
import type { InvoiceListItem, InvoiceStats } from "@/lib/repos/invoices";
import type { PayerListItem } from "@/lib/repos/payers";
import type { InvoiceStatus } from "@/lib/types";

// Billing dashboard — Invoices tab (StatCards + Toolbar + table + row
// actions) and Payers tab (payer ListRows + new/edit payer SidePanel).

const PAGE_SIZE = 8;
const STATUS_OPTIONS: Array<{ value: InvoiceStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
];

function StatusFilter({
  value,
  onChange,
}: {
  value: InvoiceStatus | null;
  onChange: (v: InvoiceStatus | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrapRef} className="relative">
      <FilterChip
        label="Status"
        value={value ? STATUS_OPTIONS.find((s) => s.value === value)?.label : undefined}
        onClick={() => setOpen((o) => !o)}
        onClear={() => {
          onChange(null);
          setOpen(false);
        }}
      />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-card border border-border bg-surface p-2 shadow-menu">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                onChange(s.value === value ? null : s.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                s.value === value ? "font-semibold text-primary" : "text-text"
              }`}
            >
              {s.label}
              {s.value === value && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function BillingDashboard({
  invoices,
  stats,
  payers,
  clients,
  services,
}: {
  invoices: InvoiceListItem[];
  stats: InvoiceStats;
  payers: PayerListItem[];
  clients: ClientOption[];
  services: ServiceOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"invoices" | "payers">("invoices");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | null>(null);
  const [page, setPage] = useState(1);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [payerPanel, setPayerPanel] = useState<{ open: boolean; payer: PayerListItem | null }>({
    open: false,
    payer: null,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter(
      (i) =>
        (!status || i.status === status) &&
        (!q || i.number.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q)),
    );
  }, [invoices, search, status]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const patchInvoice = async (id: string, patch: { status: "sent" | "void" }, done: string) => {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "Update failed.", "danger");
      return;
    }
    toast(done, "success");
    router.refresh();
  };

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
      <PageHeader
        icon="dollar"
        title="Billing"
        className="mb-4"
        actions={
          tab === "invoices" ? (
            <Button leftIcon="plus" onClick={() => setNewInvoiceOpen(true)}>
              New invoice
            </Button>
          ) : (
            <Button leftIcon="plus" onClick={() => setPayerPanel({ open: true, payer: null })}>
              New payer
            </Button>
          )
        }
      />
      <Tabs
        className="mb-6"
        items={[
          { key: "invoices", label: "Invoices", count: invoices.length },
          { key: "payers", label: "Payers", count: payers.length },
        ]}
        active={tab}
        onChange={(k) => setTab(k as "invoices" | "payers")}
      />

      {tab === "invoices" && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Outstanding" value={formatCents(stats.outstandingCents)} />
            <StatCard label="Paid this month" value={formatCents(stats.paidThisMonthCents)} />
            <StatCard label="Overdue invoices" value={stats.overdueCount} />
            <StatCard label="Drafts" value={stats.draftCount} />
          </div>

          <Toolbar count={filtered.length} countLabel="invoices" className="mb-4">
            <SearchInput
              placeholder="Search invoices or clients"
              className="w-64"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <StatusFilter
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
          </Toolbar>

          {filtered.length === 0 ? (
            <EmptyState
              icon="credit-card"
              title="No invoices match"
              subtext="Try a different search or clear the status filter."
            />
          ) : (
            <>
              <Table head={["Invoice", "Client", "Issued", "Due", "Total", "Status", ""]}>
                {paged.map((inv) => (
                  <Tr key={inv.id} onClick={() => router.push(`/billing/${inv.id}`)}>
                    <Td>
                      <TextLink href={`/billing/${inv.id}`} onClick={(e) => e.stopPropagation()}>
                        {inv.number}
                      </TextLink>
                    </Td>
                    <Td>{inv.clientName}</Td>
                    <Td>{inv.issuedOn ? formatDate(`${inv.issuedOn}T00:00:00`) : "—"}</Td>
                    <Td className={inv.status === "overdue" ? "font-medium text-danger" : ""}>
                      {inv.dueOn ? formatDate(`${inv.dueOn}T00:00:00`) : "—"}
                    </Td>
                    <Td className="font-semibold">{formatCents(inv.totalCents)}</Td>
                    <Td>
                      <InvoiceStatusBadge status={inv.status} />
                    </Td>
                    <Td className="w-12 text-right" onClick={(e) => e.stopPropagation()}>
                      <KebabMenu>
                        <MenuItem icon="file-text" label="Open" onClick={() => router.push(`/billing/${inv.id}`)} />
                        {inv.status !== "paid" && inv.status !== "void" && (
                          <MenuItem
                            icon="dollar"
                            label="Record payment"
                            onClick={() =>
                              setPaymentTarget({ id: inv.id, number: inv.number, balanceCents: inv.balanceCents })
                            }
                          />
                        )}
                        {inv.status === "draft" && (
                          <MenuItem
                            icon="send"
                            label="Mark sent"
                            onClick={() => patchInvoice(inv.id, { status: "sent" }, `${inv.number} marked sent`)}
                          />
                        )}
                        {inv.status !== "paid" && inv.status !== "void" && (
                          <MenuItem
                            icon="x"
                            danger
                            label="Void invoice"
                            onClick={() => patchInvoice(inv.id, { status: "void" }, `${inv.number} voided`)}
                          />
                        )}
                      </KebabMenu>
                    </Td>
                  </Tr>
                ))}
              </Table>
              {pageCount > 1 && (
                <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} className="mt-4" />
              )}
            </>
          )}
        </>
      )}

      {tab === "payers" && (
        <>
          {payers.length === 0 ? (
            <EmptyState
              icon="shield-plus"
              title="No payers yet"
              subtext="Add the insurance payers your practice bills so policies and superbills can reference them."
              actions={
                <Button leftIcon="plus" onClick={() => setPayerPanel({ open: true, payer: null })}>
                  New payer
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {payers.map((p) => (
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
      <RecordPaymentModal
        invoice={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onRecorded={() => router.refresh()}
      />
    </>
  );
}

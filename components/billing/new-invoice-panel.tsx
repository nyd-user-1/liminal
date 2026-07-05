"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FieldLabel, Input, fieldClass } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { SidePanel } from "@/components/ui/side-panel";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate } from "@/lib/format";

// New invoice SidePanel — client picker (unless opened from a client's
// Billing tab), items editor (description / qty / unit + Add row + service
// picker with auto amounts), due date DatePicker. Save draft or create & send.

export interface ClientOption {
  id: string;
  name: string;
}

export interface ServiceOption {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
}

interface ItemDraft {
  description: string;
  qty: string;
  unit: string; // dollars
}

const emptyItem: ItemDraft = { description: "", qty: "1", unit: "" };

function toCents(dollars: string): number {
  return Math.round(parseFloat(dollars || "0") * 100);
}

export function NewInvoicePanel({
  open,
  onClose,
  clients,
  services,
  defaultClientId,
}: {
  open: boolean;
  onClose: () => void;
  clients: ClientOption[];
  services: ServiceOption[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [items, setItems] = useState<ItemDraft[]>([{ ...emptyItem }]);
  const [dueOn, setDueOn] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setClientId(defaultClientId ?? "");
      setItems([{ ...emptyItem }]);
      setDueOn("");
      setShowCalendar(false);
    }
  }, [open, defaultClientId]);

  const totalCents = useMemo(
    () =>
      items.reduce((sum, it) => {
        const qty = parseInt(it.qty, 10);
        const unit = toCents(it.unit);
        return sum + (Number.isFinite(qty) && qty > 0 && Number.isFinite(unit) && unit > 0 ? qty * unit : 0);
      }, 0),
    [items],
  );

  const patchItem = (i: number, patch: Partial<ItemDraft>) =>
    setItems((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const addService = (serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    const row: ItemDraft = {
      description: `${svc.name} (${svc.durationMin} min)`,
      qty: "1",
      unit: (svc.priceCents / 100).toFixed(2),
    };
    setItems((rows) => {
      const last = rows[rows.length - 1];
      const isBlank = last && !last.description && !last.unit;
      return isBlank ? [...rows.slice(0, -1), row] : [...rows, row];
    });
  };

  const submit = async (status: "draft" | "sent") => {
    if (!clientId) {
      toast("Pick a client first.", "warning");
      return;
    }
    const clean = items
      .filter((it) => it.description.trim())
      .map((it) => ({
        description: it.description.trim(),
        qty: parseInt(it.qty, 10) || 1,
        unitCents: toCents(it.unit),
      }));
    if (clean.length === 0) {
      toast("Add at least one line item.", "warning");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, dueOn: dueOn || null, status, items: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the invoice.");
      toast(`${data.invoice.number} ${status === "sent" ? "created and sent" : "saved as draft"}`, "success");
      onClose();
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create the invoice.", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="New invoice"
      icon="file-text"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => submit("draft")} loading={saving}>
            Save draft
          </Button>
          <Button onClick={() => submit("sent")} loading={saving}>
            Create &amp; send
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {!defaultClientId && (
          <Select
            label="Client"
            required
            searchable
            placeholder="Choose a client…"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            value={clientId}
            onValueChange={setClientId}
          />
        )}

        <div>
          <FieldLabel>Items</FieldLabel>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_64px_110px_90px_36px] gap-2 text-[13px] font-medium text-text-muted">
              <span>Description</span>
              <span>Qty</span>
              <span>Unit</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {items.map((it, i) => {
              const qty = parseInt(it.qty, 10);
              const unit = toCents(it.unit);
              const amount = Number.isFinite(qty) && qty > 0 && unit > 0 ? qty * unit : 0;
              return (
                <div key={i} className="grid grid-cols-[1fr_64px_110px_90px_36px] items-center gap-2">
                  <Input
                    placeholder="Session, service, adjustment…"
                    value={it.description}
                    onChange={(e) => patchItem(i, { description: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) => patchItem(i, { qty: e.target.value })}
                  />
                  <div className="flex h-11 items-center rounded-field border border-field-border bg-surface transition-colors focus-within:border-field-border-focus">
                    <span className="pl-3 text-[15px] text-text-muted">$</span>
                    <input
                      inputMode="decimal"
                      placeholder="0.00"
                      value={it.unit}
                      onChange={(e) => patchItem(i, { unit: e.target.value })}
                      className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] text-text outline-none placeholder:text-text-muted"
                    />
                  </div>
                  <span className="text-right text-[15px] font-medium text-text">
                    {amount > 0 ? formatCents(amount) : "—"}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove item"
                    disabled={items.length === 1}
                    onClick={() => setItems((rows) => rows.filter((_, j) => j !== i))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-field text-text-muted transition-colors hover:bg-[#F3F4F6] hover:text-danger disabled:opacity-40"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <TextLink icon="plus" onClick={() => setItems((rows) => [...rows, { ...emptyItem }])}>
              Add row
            </TextLink>
            <div className="w-64">
              <Select
                searchable
                placeholder="Add from services…"
                options={services.map((s) => ({
                  value: s.id,
                  label: `${s.name} · ${formatCents(s.priceCents)}`,
                }))}
                value=""
                onValueChange={addService}
              />
            </div>
          </div>
        </div>

        <div>
          <FieldLabel>Due date</FieldLabel>
          <button
            type="button"
            onClick={() => setShowCalendar((s) => !s)}
            className={`${fieldClass} flex items-center justify-between text-left`}
          >
            <span className={dueOn ? "" : "text-text-muted"}>{dueOn ? formatDate(`${dueOn}T00:00:00`) : "Pick a date"}</span>
            <Icon name="calendar" size={16} className="text-text-muted" />
          </button>
          {showCalendar && (
            <div className="mt-2 rounded-card border border-border bg-surface p-4 shadow-card">
              <DatePicker
                value={dueOn || undefined}
                onChange={(d) => {
                  setDueOn(d);
                  setShowCalendar(false);
                }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-[15px] font-medium text-text-muted">Total</span>
          <span className="text-[19px] font-semibold text-text">{formatCents(totalCents)}</span>
        </div>
      </div>
    </SidePanel>
  );
}

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorSwatch } from "@/components/ui/color-swatch";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { SidePanel } from "@/components/ui/side-panel";
import { Table, Td, Tr } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { formatCents } from "@/lib/format";
import { SERVICE_COLOR_SLOTS, serviceColorHex } from "@/lib/service-colors";
import type { Service } from "@/lib/types";

type PanelState = { mode: "create" } | { mode: "edit"; service: Service } | null;

interface FormState {
  name: string;
  duration: string;
  price: string; // dollars
  color: string;
  telehealth: boolean;
  active: boolean;
}

const emptyForm: FormState = {
  name: "",
  duration: "30",
  price: "100",
  color: SERVICE_COLOR_SLOTS[0].name,
  telehealth: false,
  active: true,
};

const toForm = (s: Service): FormState => ({
  name: s.name,
  duration: String(s.durationMin),
  price: (s.priceCents / 100).toFixed(2).replace(/\.00$/, ""),
  color: s.color,
  telehealth: s.telehealth,
  active: s.active,
});

export function ServicesSettings({ initialServices }: { initialServices: Service[] }) {
  const toast = useToast();
  const [services, setServices] = useState(initialServices);
  const [panel, setPanel] = useState<PanelState>(null);
  // Standard anatomy: select column (nothing consumes the selection yet).
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const open = (p: PanelState) => {
    setForm(p?.mode === "edit" ? toForm(p.service) : emptyForm);
    setError("");
    setPanel(p);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const durationMin = Number(form.duration);
    const priceCents = Math.round(Number(form.price) * 100);
    if (!form.name.trim()) return setError("Name is required.");
    if (!Number.isInteger(durationMin) || durationMin < 5) return setError("Duration must be at least 5 minutes.");
    if (!Number.isFinite(priceCents) || priceCents < 0) return setError("Price must be a non-negative amount.");
    setError("");
    setBusy(true);
    const body = {
      name: form.name.trim(),
      durationMin,
      priceCents,
      color: form.color,
      telehealth: form.telehealth,
      active: form.active,
    };
    const isEdit = panel?.mode === "edit";
    const res = await fetch(isEdit ? `/api/services/${panel.service.id}` : "/api/services", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.service) {
      setError(data.error ?? "Could not save the service.");
      return;
    }
    const svc: Service = data.service;
    setServices((list) =>
      isEdit ? list.map((s) => (s.id === svc.id ? svc : s)) : [...list, svc].sort((a, b) => a.name.localeCompare(b.name)),
    );
    toast(isEdit ? "Service updated." : "Service created.", "success");
    setPanel(null);
  };

  return (
    <div>
      <TopBarActions>
        <Button size="sm" leftIcon="plus" onClick={() => open({ mode: "create" })}>
          New service
        </Button>
      </TopBarActions>
      <Table
        footer={
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-text-muted">
            <span className="min-w-0 truncate tabular-nums">{services.length.toLocaleString("en-US")} records</span>
            <span className="shrink-0">Data set by NYSgpt</span>
          </div>
        }
        head={[
          <Checkbox
            key="__sel"
            aria-label="Select all"
            checked={services.length > 0 && services.every((s) => sel.has(s.id))}
            onChange={() =>
              setSel((prev) => {
                const all = services.every((s) => prev.has(s.id));
                const next = new Set(prev);
                services.forEach((s) => (all ? next.delete(s.id) : next.add(s.id)));
                return next;
              })
            }
          />,
          "Service",
          "Duration",
          "Rate",
          "Type",
          "Status",
          "",
        ]}
      >
        {services.map((s) => (
          <Tr key={s.id} onClick={() => open({ mode: "edit", service: s })}>
            <Td className="w-10" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                aria-label="Select row"
                checked={sel.has(s.id)}
                onChange={() =>
                  setSel((prev) => {
                    const next = new Set(prev);
                    if (!next.delete(s.id)) next.add(s.id);
                    return next;
                  })
                }
              />
            </Td>
            <Td className="font-semibold text-text">
              <span className="flex items-center gap-2.5">
                <ColorSwatch color={serviceColorHex(s.color)} />
                {s.name}
              </span>
            </Td>
            <Td className="whitespace-nowrap">{s.durationMin} mins</Td>
            <Td className="whitespace-nowrap">{formatCents(s.priceCents)}</Td>
            <Td>
              {s.telehealth ? (
                <Tag hue="teal">
                  <Icon name="video" size={12} /> Telehealth
                </Tag>
              ) : (
                <span className="text-text-muted">In office</span>
              )}
            </Td>
            <Td>
              {s.active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
            </Td>
            <Td className="w-12" onClick={(e) => e.stopPropagation()}>
              <KebabMenu label={`Actions for ${s.name}`}>
                <MenuItem icon="edit" label="Edit" onClick={() => open({ mode: "edit", service: s })} />
              </KebabMenu>
            </Td>
          </Tr>
        ))}
      </Table>

      <SidePanel
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panel?.mode === "edit" ? "Edit service" : "New service"}
        icon="clipboard"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPanel(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={save}>
              {panel?.mode === "edit" ? "Save changes" : "Create service"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Name"
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Follow-up"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Duration"
              required
              type="number"
              min={5}
              step={5}
              suffix="mins"
              value={form.duration}
              onChange={(e) => set("duration", e.target.value)}
            />
            <Field
              label="Price"
              required
              type="number"
              min={0}
              step="0.01"
              prefix="$"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Calendar color</FieldLabel>
            <div className="flex items-center gap-2.5">
              {SERVICE_COLOR_SLOTS.map((c) => (
                <ColorSwatch
                  key={c.name}
                  color={c.hex}
                  selected={form.color === c.name}
                  onSelect={() => set("color", c.name)}
                />
              ))}
            </div>
          </div>
          <Toggle
            checked={form.telehealth}
            onChange={(v) => set("telehealth", v)}
            label="Telehealth service"
            subtitle="Appointments get a video room and a join link automatically."
          />
          <Toggle
            checked={form.active}
            onChange={(v) => set("active", v)}
            label="Active"
            subtitle="Inactive services stay on past appointments but can't be booked."
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>
      </SidePanel>
    </div>
  );
}

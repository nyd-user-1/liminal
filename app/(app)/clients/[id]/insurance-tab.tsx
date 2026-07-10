"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { FileUpload } from "@/components/ui/file-upload";
import { Icon, IconSquare } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Radio } from "@/components/ui/radio";
import { Select } from "@/components/ui/select";
import { SidePanel } from "@/components/ui/side-panel";
import { useToast } from "@/components/ui/toast";
import { formatCents } from "@/lib/format";
import type { PolicyWithPayer } from "@/lib/repos/policies";
import type { FileRecord, Payer, PolicyKind } from "@/lib/types";
import { FieldDisplay, PolicyStatusBadge } from "../ui";

// Insurance tab — policy ListRows (payer + member id + Verified/Unverified
// Badge) expanding in place (catalog AccordionSection `in-row` variant) to a
// FieldDisplay grid + insurance-card FileUpload tiles; "+ New policy"
// SidePanel with searchable payer Select, ids, kind Radio, $-prefixed copay.

const KIND_LABELS: Record<PolicyKind, string> = { primary: "Primary", secondary: "Secondary" };

function PolicyRow({
  policy,
  clientId,
  cardFront,
  cardBack,
}: {
  policy: PolicyWithPayer;
  clientId: string;
  cardFront: FileRecord | null;
  cardBack: FileRecord | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  async function patch(body: Record<string, unknown>, message: string) {
    const res = await fetch(`/api/policies/${policy.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast(message, "success");
      router.refresh();
    } else {
      toast("Could not update the policy.", "danger");
    }
  }

  async function remove() {
    const res = await fetch(`/api/policies/${policy.id}`, { method: "DELETE" });
    if (res.ok) {
      toast(`${policy.payerName} policy removed`, "success");
      router.refresh();
    } else {
      toast("Could not remove the policy.", "danger");
    }
  }

  async function uploadCard(side: "front" | "back", file: File) {
    const renamed = new File([file], `insurance-card-${side}-${file.name}`, { type: file.type });
    const form = new FormData();
    form.append("file", renamed);
    form.append("clientId", clientId);
    const res = await fetch("/api/files", { method: "POST", body: form });
    if (res.ok) {
      toast(`Insurance card (${side}) uploaded`, "success");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast(data?.error ?? "Upload failed.", "danger");
    }
  }

  return (
    <div className="overflow-visible rounded-card border border-border bg-surface shadow-card">
      <div
        className={`flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas ${
          open ? "rounded-t-card" : "rounded-card"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <IconSquare name="shield-plus" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[15px] font-semibold text-text">
              {policy.payerName}
              <span className="font-normal text-text-muted">{policy.payerCode}</span>
            </span>
            <span className="mt-0.5 block truncate text-sm text-text-muted">
              {KIND_LABELS[policy.kind]} · Member ID {policy.memberId}
            </span>
          </span>
          <PolicyStatusBadge status={policy.status} />
          <Icon name={open ? "chevron-up" : "chevron-down"} size={18} className="shrink-0 text-text-muted" />
        </button>
        <KebabMenu label={`Actions for ${policy.payerName} policy`}>
          {policy.status !== "verified" && (
            <MenuItem icon="check" label="Mark verified" onClick={() => patch({ status: "verified" }, "Policy marked verified")} />
          )}
          {policy.status === "verified" && (
            <MenuItem icon="warning-triangle" label="Mark unverified" onClick={() => patch({ status: "unverified" }, "Policy marked unverified")} />
          )}
          {policy.status !== "inactive" && (
            <MenuItem icon="eye-off" label="Mark inactive" onClick={() => patch({ status: "inactive" }, "Policy marked inactive")} />
          )}
          <MenuItem icon="trash" label="Delete policy" danger onClick={remove} />
        </KebabMenu>
      </div>
      {open && (
        <div className="border-t border-border px-4 py-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <FieldDisplay label="Insurance payer" value={`${policy.payerName} (${policy.payerCode})`} />
            <FieldDisplay label="Type" value={KIND_LABELS[policy.kind]} />
            <FieldDisplay label="Status" value={<PolicyStatusBadge status={policy.status} />} />
            <FieldDisplay label="Member ID" value={policy.memberId} />
            <FieldDisplay label="Group ID" value={policy.groupId} />
            <FieldDisplay
              label="Co-pay"
              value={policy.copayCents !== null ? formatCents(policy.copayCents) : null}
            />
          </div>
          <div className="mt-5">
            <div className="mb-2 text-sm font-medium text-text-body">Insurance card</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FileUpload
                file={cardFront ? { name: cardFront.name } : null}
                onFile={(f) => uploadCard("front", f)}
                accept="image/*,.pdf"
                constraints="Front · JPG, PNG or PDF · max 10 MB"
              />
              <FileUpload
                file={cardBack ? { name: cardBack.name } : null}
                onFile={(f) => uploadCard("back", f)}
                accept="image/*,.pdf"
                constraints="Back · JPG, PNG or PDF · max 10 MB"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = { payerId: "", memberId: "", groupId: "", kind: "primary" as PolicyKind, copay: "" };

export function InsuranceTab({
  clientId,
  policies,
  payers,
  files,
}: {
  clientId: string;
  policies: PolicyWithPayer[];
  payers: Payer[];
  files: FileRecord[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardFront = files.find((f) => f.name.startsWith("insurance-card-front")) ?? null;
  const cardBack = files.find((f) => f.name.startsWith("insurance-card-back")) ?? null;

  async function create() {
    if (!form.payerId || !form.memberId.trim()) {
      setError("Payer and member ID are required.");
      return;
    }
    const copay = form.copay.trim() ? Math.round(parseFloat(form.copay) * 100) : null;
    if (form.copay.trim() && (!Number.isFinite(copay) || (copay as number) < 0)) {
      setError("Co-pay must be a dollar amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          payerId: form.payerId,
          memberId: form.memberId,
          groupId: form.groupId || null,
          kind: form.kind,
          copayCents: copay,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not create the policy.");
        return;
      }
      toast("Insurance policy added", "success");
      setForm(EMPTY_FORM);
      setPanelOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[19px] font-semibold text-text">Insurance policies</h2>
        <Button size="sm" leftIcon="plus" onClick={() => setPanelOpen(true)}>
          New policy
        </Button>
      </div>

      {policies.length === 0 ? (
        <div className="rounded-card border border-border bg-surface shadow-card">
          <EmptyState
            icon="shield-plus"
            title="No insurance on file"
            subtext="Add a policy to bill this client's insurance."
            actions={
              <Button leftIcon="plus" onClick={() => setPanelOpen(true)}>
                New policy
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {policies.map((p) => (
            <PolicyRow key={p.id} policy={p} clientId={clientId} cardFront={cardFront} cardBack={cardBack} />
          ))}
        </div>
      )}

      <SidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="New insurance policy"
        icon="shield-plus"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={create}>
              Create
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Insurance payer"
            required
            searchable
            placeholder="Search payers…"
            className="col-span-2"
            options={payers.map((p) => ({ value: p.id, label: `${p.payerCode} — ${p.name}` }))}
            value={form.payerId}
            onValueChange={(v) => setForm((f) => ({ ...f, payerId: v }))}
          />
          <Field
            label="Member ID"
            required
            value={form.memberId}
            onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
            placeholder="W442918203"
          />
          <Field
            label="Group ID"
            value={form.groupId}
            onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
            placeholder="GRP-88410"
          />
          <div className="col-span-2">
            <FieldLabel>Insurance type</FieldLabel>
            <div className="flex items-center gap-6">
              {(Object.keys(KIND_LABELS) as PolicyKind[]).map((k) => (
                <Radio
                  key={k}
                  name="policy-kind"
                  label={KIND_LABELS[k]}
                  checked={form.kind === k}
                  onChange={() => setForm((f) => ({ ...f, kind: k }))}
                />
              ))}
            </div>
          </div>
          <Field
            label="Co-pay"
            prefix="$"
            inputMode="decimal"
            value={form.copay}
            onChange={(e) => setForm((f) => ({ ...f, copay: e.target.value }))}
            placeholder="25.00"
            hint="Per-visit co-pay, if known"
          />
        </div>
        {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
      </SidePanel>
    </div>
  );
}

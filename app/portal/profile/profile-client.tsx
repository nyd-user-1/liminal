"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Select, type SelectOption } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { PolicyKind, PolicyStatus } from "@/lib/types";

export interface ProfileData {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  dob: string | null;
  gender: string | null;
  pronouns: string | null;
}

export interface PortalPolicy {
  id: string;
  payerId: string;
  payerName: string;
  memberId: string;
  groupId: string | null;
  kind: PolicyKind;
  status: PolicyStatus;
}

const POLICY_STATUS: Record<PolicyStatus, { label: string; variant: "success" | "warning" | "neutral" }> = {
  verified: { label: "Verified", variant: "success" },
  unverified: { label: "Pending verification", variant: "warning" },
  inactive: { label: "Inactive", variant: "neutral" },
};

/** Add/edit one policy — client-entered details go back to unverified. */
function PolicyModal({
  policy,
  payers,
  onClose,
}: {
  policy: PortalPolicy | null; // null = add
  payers: SelectOption[];
  onClose: (saved: boolean) => void;
}) {
  const toast = useToast();
  const [payerId, setPayerId] = useState(policy?.payerId ?? "");
  const [memberId, setMemberId] = useState(policy?.memberId ?? "");
  const [groupId, setGroupId] = useState(policy?.groupId ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!payerId || !memberId.trim()) {
      toast("Insurer and member ID are required.", "danger");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/portal/insurance", {
        method: policy ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          policy
            ? { id: policy.id, payerId, memberId, groupId }
            : { payerId, memberId, groupId },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not save your insurance.", "danger");
        return;
      }
      toast("Insurance saved — your practice will verify it.", "success");
      onClose(true);
    } catch {
      toast("Something went wrong. Please try again.", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => onClose(false)}
      title={policy ? "Update insurance" : "Add insurance"}
      icon="shield-plus"
      footer={
        <>
          <Button variant="secondary" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Save insurance
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Insurer"
          required
          searchable
          options={payers}
          placeholder="Choose your insurance plan"
          value={payerId}
          onValueChange={setPayerId}
        />
        <Field
          label="Member ID"
          name="memberId"
          required
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          placeholder="As printed on your card"
        />
        <Field
          label="Group number"
          name="groupId"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          placeholder="Optional"
        />
      </div>
    </Modal>
  );
}

export function ProfileClient({
  client,
  policies,
  payers,
}: {
  client: ProfileData;
  policies: PortalPolicy[];
  payers: SelectOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [phone, setPhone] = useState(client.phone ?? "");
  const [address, setAddress] = useState(client.address ?? "");
  const [dob, setDob] = useState(client.dob ?? "");
  const [gender, setGender] = useState(client.gender ?? "");
  const [pronouns, setPronouns] = useState(client.pronouns ?? "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PortalPolicy | null | "new">(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, address, dob: dob || null, gender, pronouns }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not save your details.", "danger");
        return;
      }
      toast("Details saved.", "success");
      router.refresh();
    } catch {
      toast("Something went wrong. Please try again.", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Icon name="person-circle" size={19} className="text-primary" />
          <h2 className="text-[19px] font-semibold text-text">Your details</h2>
        </div>
        <div className="grid grid-cols-1 gap-1 text-[15px] sm:grid-cols-2">
          <p className="text-text-muted">
            Name <span className="mt-0.5 block font-medium text-text">{client.name}</span>
          </p>
          <p className="text-text-muted">
            Email <span className="mt-0.5 block font-medium text-text">{client.email ?? "—"}</span>
          </p>
        </div>
        <p className="text-[13px] text-text-muted">
          To change your name or email, message your care team.
        </p>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-0100" />
            <Field label="Date of birth" name="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <Field label="Address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state, ZIP" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Gender" name="gender" value={gender} onChange={(e) => setGender(e.target.value)} />
            <Field label="Pronouns" name="pronouns" value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="e.g. she/her" />
          </div>
          <Button type="submit" loading={saving}>
            Save details
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Icon name="shield-plus" size={19} className="text-primary" />
          <h2 className="text-[19px] font-semibold text-text">Insurance</h2>
          <Button size="sm" variant="secondary" leftIcon="plus" className="ml-auto" onClick={() => setEditing("new")}>
            Add insurance
          </Button>
        </div>
        {policies.length === 0 ? (
          <p className="text-[15px] text-text-muted">
            No insurance on file — add your plan so your practice can verify coverage before your visit.
          </p>
        ) : (
          <ul className="space-y-3">
            {policies.map((p) => {
              const s = POLICY_STATUS[p.status];
              return (
                <li key={p.id} className="flex items-start justify-between gap-3 rounded-field border border-border p-3">
                  <div>
                    <p className="text-[15px] font-semibold text-text">
                      {p.payerName}
                      <Badge variant={s.variant} className="ml-2">{s.label}</Badge>
                    </p>
                    <p className="mt-0.5 text-sm text-text-body">
                      Member ID {p.memberId}
                      {p.groupId ? ` · Group ${p.groupId}` : ""} · {p.kind === "primary" ? "Primary" : "Secondary"}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[13px] text-text-muted">
          Changes you make are re-verified by your practice before billing.
        </p>
      </Card>

      {editing !== null && (
        <PolicyModal
          policy={editing === "new" ? null : editing}
          payers={payers}
          onClose={(saved) => {
            setEditing(null);
            if (saved) router.refresh();
          }}
        />
      )}
    </div>
  );
}

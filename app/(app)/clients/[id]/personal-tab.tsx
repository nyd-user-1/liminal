"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconSquare } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { PractitionerOption } from "@/lib/repos/clients";
import type { Client } from "@/lib/types";

// Personal tab — editable details form card (Team UI form-card anatomy:
// IconSquare + title header · 2-col Field grid · Cancel/Save footer).

const GENDERS = ["Female", "Male", "Non-binary", "Prefer to self-describe", "Prefer not to say"];

function fromClient(client: Client) {
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    dob: client.dob ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    gender: client.gender ?? "",
    pronouns: client.pronouns ?? "",
    tags: client.tags.join(", "),
    primaryPractitionerId: client.primaryPractitionerId ?? "",
  };
}

export function PersonalTab({
  client,
  practitioners,
}: {
  client: Client;
  practitioners: PractitionerOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(() => fromClient(client));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof ReturnType<typeof fromClient>) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          dob: form.dob || null,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
          gender: form.gender || null,
          pronouns: form.pronouns || null,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          primaryPractitionerId: form.primaryPractitionerId || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not save changes.");
        return;
      }
      toast("Client details saved", "success");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl rounded-card border border-border bg-surface p-6 shadow-card">
      <div className="mb-5 flex items-center gap-2.5">
        <IconSquare name="person-circle" />
        <h2 className="text-[19px] font-semibold text-text">Client details</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" required value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} />
        <Field label="Last name" required value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} />
        <Field label="Date of birth" type="date" value={form.dob} onChange={(e) => set("dob")(e.target.value)} />
        <Field label="Email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} />
        <Field label="Phone" type="tel" value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
        <Select
          label="Gender"
          placeholder="Select…"
          options={GENDERS.map((g) => ({ value: g, label: g }))}
          value={form.gender}
          onValueChange={set("gender")}
        />
        <Field
          label="Address"
          className="col-span-2"
          value={form.address}
          onChange={(e) => set("address")(e.target.value)}
          placeholder="Street, city, state, zip"
        />
        <Field
          label="Pronouns"
          value={form.pronouns}
          onChange={(e) => set("pronouns")(e.target.value)}
          placeholder="they/them"
        />
        <Field
          label="Tags"
          value={form.tags}
          onChange={(e) => set("tags")(e.target.value)}
          hint="Comma separated"
        />
        <Select
          label="Primary practitioner"
          placeholder="Select…"
          className="col-span-2"
          options={practitioners.map((p) => ({ value: p.id, label: p.name }))}
          value={form.primaryPractitionerId}
          onValueChange={set("primaryPractitionerId")}
        />
      </div>
      {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
      <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
        <Button variant="secondary" onClick={() => setForm(fromClient(client))}>
          Cancel
        </Button>
        <Button loading={saving} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SidePanel } from "@/components/ui/side-panel";
import { useToast } from "@/components/ui/toast";
import type { PractitionerOption } from "@/lib/repos/clients";

// "+ New client" SidePanel — 2-col demographics form → POST /api/clients.

const GENDERS = ["Female", "Male", "Non-binary", "Prefer to self-describe", "Prefer not to say"];

const EMPTY = {
  firstName: "",
  lastName: "",
  dob: "",
  email: "",
  phone: "",
  gender: "",
  pronouns: "",
  tags: "",
  primaryPractitionerId: "",
};

export function NewClientPanel({
  open,
  onClose,
  practitioners,
}: {
  open: boolean;
  onClose: () => void;
  practitioners: PractitionerOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          dob: form.dob || null,
          email: form.email || null,
          phone: form.phone || null,
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
        setError(data?.error ?? "Could not create the client.");
        return;
      }
      toast(
        <>
          <b>
            {form.firstName} {form.lastName}
          </b>{" "}
          added to clients
        </>,
        "success",
      );
      setForm(EMPTY);
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="New client"
      icon="users"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit}>
            Create client
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="First name"
          required
          value={form.firstName}
          onChange={(e) => set("firstName")(e.target.value)}
          placeholder="Casey"
        />
        <Field
          label="Last name"
          required
          value={form.lastName}
          onChange={(e) => set("lastName")(e.target.value)}
          placeholder="Morgan"
        />
        <Field label="Date of birth" type="date" value={form.dob} onChange={(e) => set("dob")(e.target.value)} />
        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set("email")(e.target.value)}
          placeholder="name@example.com"
        />
        <Field
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={(e) => set("phone")(e.target.value)}
          placeholder="+1 212 555 0100"
        />
        <Select
          label="Gender"
          placeholder="Select…"
          options={GENDERS.map((g) => ({ value: g, label: g }))}
          value={form.gender}
          onValueChange={set("gender")}
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
          placeholder="anxiety, weekly"
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
    </SidePanel>
  );
}

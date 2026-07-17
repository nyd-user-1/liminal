"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { PractitionerOption } from "@/lib/repos/clients";
import type { Client } from "@/lib/types";

// Personal tab — editable details form card (Team UI form-card anatomy:
// IconSquare + title header · 2-col Field grid · Cancel/Save footer).
//
// `readOnly` is the patient-portal variant (app/portal/page.tsx): the same form,
// every control disabled and the Cancel/Save footer gone. A patient sees what
// the practice holds on them but cannot rewrite it — `PATCH /api/clients/:id`
// is practitioner-only anyway, so an enabled Save here would only ever 403.
// Corrections go through their care team.

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
  readOnly = false,
  bare = false,
}: {
  client: Client;
  practitioners: PractitionerOption[];
  readOnly?: boolean;
  /** Drop this section's own card chrome: the host is already a card and is
   *  drawing the title (the client board). Contents are untouched. */
  bare?: boolean;
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

  // On the board the BoardCard is already the card and already draws the title,
  // so `bare` swaps the SettingsCard for a plain box — the form is untouched.
  const Shell = bare
    ? ({ children }: { children: ReactNode }) => <div>{children}</div>
    : ({ children }: { children: ReactNode }) => (
        <SettingsCard icon="person-circle" title="Client details" className="max-w-3xl">
          {children}
        </SettingsCard>
      );

  return (
    <Shell>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" required disabled={readOnly} value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} />
        <Field label="Last name" required disabled={readOnly} value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} />
        <Field label="Date of birth" type="date" disabled={readOnly} value={form.dob} onChange={(e) => set("dob")(e.target.value)} />
        <Field label="Email" type="email" disabled={readOnly} value={form.email} onChange={(e) => set("email")(e.target.value)} />
        <Field label="Phone" type="tel" disabled={readOnly} value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
        <Select
          label="Gender"
          placeholder="Select…"
          disabled={readOnly}
          options={GENDERS.map((g) => ({ value: g, label: g }))}
          value={form.gender}
          onValueChange={set("gender")}
        />
        <Field
          label="Address"
          className="sm:col-span-2"
          disabled={readOnly}
          value={form.address}
          onChange={(e) => set("address")(e.target.value)}
          placeholder="Street, city, state, zip"
        />
        <Field
          label="Pronouns"
          disabled={readOnly}
          value={form.pronouns}
          onChange={(e) => set("pronouns")(e.target.value)}
          placeholder="they/them"
        />
        <Field
          label="Tags"
          disabled={readOnly}
          value={form.tags}
          onChange={(e) => set("tags")(e.target.value)}
          hint="Comma separated"
        />
        <Select
          label="Primary practitioner"
          placeholder="Select…"
          className="sm:col-span-2"
          disabled={readOnly}
          options={practitioners.map((p) => ({ value: p.id, label: p.name }))}
          value={form.primaryPractitionerId}
          onValueChange={set("primaryPractitionerId")}
        />
      </div>
      {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
      {readOnly ? (
        <p className="mt-6 border-t border-border pt-4 text-[13px] text-text-muted">
          Need something here corrected? Message your care team and they&rsquo;ll update it.
        </p>
      ) : (
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
          <Button variant="secondary" onClick={() => setForm(fromClient(client))}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      )}
    </Shell>
  );
}

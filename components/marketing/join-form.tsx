"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";

const STEPS = ["License type", "Credentials", "Contact"];

const LICENSE_TYPES = [
  "Psychologist (PhD/PsyD)",
  "Psychiatrist (MD/DO)",
  "Clinical Social Worker (LCSW)",
  "Mental Health Counselor (LMHC)",
  "Marriage & Family Therapist (LMFT)",
  "Other",
];

const STATES = [
  { value: "NY", label: "New York" },
  { value: "NJ", label: "New Jersey" },
  { value: "CT", label: "Connecticut" },
  { value: "PA", label: "Pennsylvania" },
  { value: "Other", label: "Other" },
];

export function JoinForm() {
  const router = useRouter();
  // Handoff from a directory provider page's "Is this you? Claim this
  // profile" link — prefills what we already know so a real clinician
  // doesn't retype their own name/NPI to claim a listing that's already theirs.
  const params = useSearchParams();
  const claiming = params.get("claim") === "1";
  const [step, setStep] = useState(0);
  const [licenseType, setLicenseType] = useState("");
  const [npi, setNpi] = useState(params.get("npi") ?? "");
  const [state, setState] = useState(params.get("state") ?? "NY");
  const [name, setName] = useState(params.get("name") ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    claiming ? "I'd like to claim my directory listing on Leuk and turn on online booking." : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canNext = step === 0 ? !!licenseType : step === 1 ? true : !!name.trim() && /.+@.+\..+/.test(email);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/directory/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, licenseType, state, npi, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <div className="flex flex-col items-center gap-4 py-8">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-tint text-success">
            <Icon name="check" size={28} />
          </span>
          <h2 className="text-2xl font-semibold text-text">Application received</h2>
          <p className="max-w-sm text-text-body">
            Thanks, {name.split(" ")[0] || "there"}. Our team will review your credentials and reach out at{" "}
            <span className="font-medium text-text">{email}</span> within two business days.
          </p>
          <Button variant="secondary" onClick={() => router.push("/")}>
            Back to home
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-xl">
      <Stepper steps={STEPS} active={step} className="mb-8" />

      {step === 0 && (
        <div>
          <h2 className="text-lg font-semibold text-text">What's your license type?</h2>
          <p className="mt-1 text-sm text-text-muted">Select the credential you practice under.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {LICENSE_TYPES.map((lt) => (
              <ChoiceChip key={lt} label={lt} selected={licenseType === lt} onSelect={() => setLicenseType(lt)} />
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text">Your credentials</h2>
          <Field
            label="NPI number"
            name="npi"
            placeholder="10-digit National Provider Identifier"
            hint="Optional — helps us verify you faster."
            value={npi}
            inputMode="numeric"
            onChange={(e) => setNpi(e.target.value)}
          />
          <Select label="License state" options={STATES} value={state} onValueChange={setState} />
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text">How can we reach you?</h2>
          <Field label="Full name" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Field
            label="Email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field label="Phone" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Field
            label="Anything else?"
            name="message"
            placeholder="Specialties, availability, questions…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Continue
          </Button>
        ) : (
          <Button onClick={submit} loading={submitting} disabled={!canNext}>
            Submit application
          </Button>
        )}
      </div>
    </Card>
  );
}

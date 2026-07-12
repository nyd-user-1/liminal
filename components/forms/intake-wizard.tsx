"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { FieldError, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Radio } from "@/components/ui/radio";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { Textarea } from "@/components/ui/textarea";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import type { Form, FormBlock, FormResponse } from "@/lib/types";

// Portal intake wizard (Carepatron Form UI, client-side fill): Stepper
// across sections (info blocks start a step), every block type rendered
// live (scale = ChoiceChip 0–3, signature = type-to-sign, checkbox =
// consent or multi-select), required validation per step, save-progress,
// Submit → confirmation (+ thread notification via the repo). Already
// submitted responses render as a read-only review.

interface Section {
  heading: string | null;
  blocks: FormBlock[]; // non-info question blocks
}

function toSections(schema: FormBlock[]): Section[] {
  const sections: Section[] = [];
  for (const b of schema) {
    if (b.type === "info") {
      sections.push({ heading: b.label, blocks: [] });
      continue;
    }
    if (sections.length === 0) sections.push({ heading: null, blocks: [] });
    sections[sections.length - 1].blocks.push(b);
  }
  return sections.filter((s) => s.heading !== null || s.blocks.length > 0);
}

/** Short Stepper label from a section heading ("Welcome to Leuk…"). */
function stepLabel(s: Section, i: number): string {
  if (!s.heading) return `Step ${i + 1}`;
  const words = s.heading.split(/\s+/);
  let label = "";
  for (const w of words) {
    if ((label + " " + w).trim().length > 20) return `${label.trim()}…`;
    label = `${label} ${w}`;
  }
  return label.trim().replace(/[.,:;]$/, "");
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0);
}

function BlockControl({
  block,
  value,
  onChange,
  error,
}: {
  block: FormBlock;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  const options = block.options ?? [];
  switch (block.type) {
    case "text":
      return <Input value={(value as string) ?? ""} error={!!error} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <Textarea rows={4} value={(value as string) ?? ""} error={error} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return (
        <Input type="date" className="max-w-56" value={(value as string) ?? ""} error={!!error} onChange={(e) => onChange(e.target.value)} />
      );
    case "select":
      return (
        <Select
          placeholder="Choose…"
          options={options.map((o) => ({ value: o, label: o }))}
          value={(value as string) ?? ""}
          onValueChange={onChange}
          className="max-w-72"
        />
      );
    case "yesno":
    case "radio":
      return (
        <div className="space-y-2.5">
          {options.map((o) => (
            <div key={o}>
              <Radio name={block.id} label={o} checked={value === o} onChange={() => onChange(o)} />
            </div>
          ))}
        </div>
      );
    case "checkbox": {
      if (options.length > 0) {
        const picked = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="space-y-2.5">
            {options.map((o) => (
              <div key={o}>
                <Checkbox
                  label={o}
                  checked={picked.includes(o)}
                  onChange={(e) => onChange(e.target.checked ? [...picked, o] : picked.filter((x) => x !== o))}
                />
              </div>
            ))}
          </div>
        );
      }
      // Consent checkbox — the block label is the agreement copy.
      return (
        <Checkbox
          label={<span className="text-[15px] leading-snug text-text-body">{block.label}</span>}
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="items-start"
        />
      );
    }
    case "scale":
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <ChoiceChip key={o} label={o} selected={String(value ?? "") === o} onSelect={() => onChange(o)} />
          ))}
        </div>
      );
    case "signature":
      return (
        <div>
          <Input
            placeholder="Type your full name to sign"
            value={(value as string) ?? ""}
            error={!!error}
            onChange={(e) => onChange(e.target.value)}
            className="max-w-md font-serif text-lg italic"
          />
          <p className="mt-1.5 text-[13px] text-text-muted">Typing your full name acts as your electronic signature.</p>
        </div>
      );
    default:
      return null;
  }
}

function answerText(block: FormBlock, v: unknown): string {
  if (isEmpty(v)) return "—";
  if (block.type === "checkbox" && !block.options?.length) return v === true ? "Agreed" : "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export function IntakeWizard({ form, response }: { form: Form; response: FormResponse }) {
  const router = useRouter();
  const toast = useToast();
  const sections = useMemo(() => toSections(form.schema), [form.schema]);

  const [answers, setAnswers] = useState<Record<string, unknown>>(response.answers ?? {});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const setAnswer = (id: string, v: unknown) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setErrors((e) => {
      if (!(id in e)) return e;
      const next = { ...e };
      delete next[id];
      return next;
    });
  };

  const validate = (blocks: FormBlock[]): boolean => {
    const missing: Record<string, string> = {};
    for (const b of blocks) {
      if (b.required && isEmpty(answers[b.id])) {
        missing[b.id] = b.type === "checkbox" && !b.options?.length ? "Please check this box to continue." : "This question is required.";
      }
    }
    setErrors(missing);
    if (Object.keys(missing).length > 0) {
      toast("Please answer the required questions.", "warning");
      return false;
    }
    return true;
  };

  const saveProgress = async () => {
    setBusy("save");
    const res = await fetch(`/api/forms/responses/${response.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setBusy(null);
    if (!res.ok) {
      toast("Could not save your progress.", "danger");
      return;
    }
    toast("Progress saved — you can come back anytime.", "success");
  };

  const submit = async () => {
    if (!validate(sections.flatMap((s) => s.blocks))) return;
    setBusy("submit");
    const res = await fetch(`/api/forms/responses/${response.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast(data?.error ?? "Could not submit the form.", "danger");
      return;
    }
    setJustSubmitted(true);
    router.refresh();
  };

  // ── confirmation (right after submit) ─────────────────────────────────────
  if (justSubmitted) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <span className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-tint text-success">
          <Icon name="check" size={28} />
        </span>
        <h1 className="text-[28px] font-bold text-text">Thank you!</h1>
        <p className="mt-2 text-[15px] text-text-body">
          &quot;{form.title}&quot; was submitted and your care team has been notified in your messages.
        </p>
        <div className="mt-6 flex items-center justify-center gap-5">
          <TextLink href="/portal/forms" icon="arrow-left">Back to forms</TextLink>
          <TextLink href="/portal/messages">Open messages</TextLink>
        </div>
      </div>
    );
  }

  // ── read-only review (already submitted) ──────────────────────────────────
  if (response.status === "submitted") {
    return (
      <div className="mx-auto max-w-2xl">
        <TextLink href="/portal/forms" icon="arrow-left" className="mb-4">Back to forms</TextLink>
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-[28px] font-bold text-text">{form.title}</h1>
          <Badge variant="success">Submitted{response.submittedAt ? ` ${formatDate(response.submittedAt)}` : ""}</Badge>
        </div>
        <div className="space-y-5">
          {sections.map((s, i) => (
            <section key={i} className="relative overflow-hidden rounded-card border border-border bg-surface p-5 shadow-card">
              <span className="absolute inset-y-0 left-0 w-1 bg-primary" />
              {s.heading && <h2 className="mb-3 text-[17px] font-bold text-text">{s.heading}</h2>}
              <dl className="space-y-3">
                {s.blocks.map((b) => (
                  <div key={b.id}>
                    <dt className="text-sm font-medium text-text-muted">{b.label}</dt>
                    <dd className="text-[15px] text-text">{answerText(b, response.answers[b.id])}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // ── fill wizard ────────────────────────────────────────────────────────────
  const section = sections[step];
  const last = step === sections.length - 1;

  return (
    <div className="mx-auto max-w-2xl">
      <TextLink href="/portal/forms" icon="arrow-left" className="mb-4">Back to forms</TextLink>
      <h1 className="text-[28px] font-bold text-text">{form.title}</h1>
      {form.description && <p className="mt-1 text-[15px] text-text-body">{form.description}</p>}

      {sections.length > 1 && (
        <Stepper steps={sections.map(stepLabel)} active={step} className="mt-6" />
      )}

      <div className="mt-6 space-y-4">
        {section?.heading && (
          <div className="relative overflow-hidden rounded-card border border-border bg-surface px-5 py-4 shadow-card">
            <span className="absolute inset-y-0 left-0 w-1 bg-primary" />
            <p className="text-[17px] font-bold text-text">{section.heading}</p>
          </div>
        )}
        {section?.blocks.map((b) => (
          <div key={b.id} className="rounded-card border border-border bg-surface px-5 py-4 shadow-card">
            {!(b.type === "checkbox" && !b.options?.length) && (
              <p className="mb-2.5 text-[15px] font-semibold text-text">
                {b.label}
                {b.required && <span className="ml-0.5 text-danger">*</span>}
              </p>
            )}
            <BlockControl block={b} value={answers[b.id]} onChange={(v) => setAnswer(b.id, v)} error={errors[b.id]} />
            {errors[b.id] && b.type !== "textarea" && <FieldError>{errors[b.id]}</FieldError>}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3 border-t border-border pt-5">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>
        )}
        <Button variant="ghost" onClick={saveProgress} loading={busy === "save"} disabled={busy === "submit"}>
          Save progress
        </Button>
        <span className="flex-1" />
        {last ? (
          <Button leftIcon="send" onClick={submit} loading={busy === "submit"} disabled={busy === "save"}>
            Submit
          </Button>
        ) : (
          <Button
            onClick={() => {
              if (validate(section?.blocks ?? [])) setStep(step + 1);
            }}
          >
            Next
          </Button>
        )}
      </div>
      <p className="mt-3 text-[13px] text-text-muted">
        Your answers are confidential and shared only with your care team.
        {sections.length > 1 && ` Step ${step + 1} of ${sections.length}.`}
      </p>
    </div>
  );
}

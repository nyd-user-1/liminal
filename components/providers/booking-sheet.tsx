"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { TextLink } from "@/components/ui/text-link";
import { formatCents } from "@/lib/format";
import type { Payer, Service } from "@/lib/types";

// Bottom-sheet booking flow, opened by BookingRail the moment a time is
// picked (the Grow Therapy reference): the chosen slot is confirmed up top,
// each Continue smoothly reveals the next section (mkt-rise), and a pinned
// three-phase progress bar (Time · Details · Cost estimate) tracks the whole
// thing. Insurance is asked here — with the details, where it belongs — not
// on the provider page. POSTs to the same /api/book endpoint as the /book
// wizard.

const SELF_PAY = "";
const PHASES = ["time", "details", "estimate"] as const;
type Phase = (typeof PHASES)[number] | "done";
const PHASE_LABELS: Record<(typeof PHASES)[number], string> = {
  time: "Time",
  details: "Details",
  estimate: "Cost estimate",
};

const CONFIDENCE = [
  "Cancel for free up to 24 hours before your visit",
  "We verify your insurance and confirm any copay for you",
  "Your data is protected under HIPAA — handled with care",
];

const prettyDateTime = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

export function BookingSheet({
  open,
  onClose,
  practitionerId,
  service,
  payers,
  date,
  time,
}: {
  open: boolean;
  onClose: () => void;
  practitionerId: string;
  service: Service;
  payers: Payer[];
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}) {
  const [phase, setPhase] = useState<Phase>("time");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payerId, setPayerId] = useState(SELF_PAY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // A fresh slot choice restarts the flow (contact details survive on purpose —
  // re-picking a time shouldn't cost the user their typed name/email).
  useEffect(() => {
    if (open) {
      setPhase("time");
      setError("");
    }
  }, [open, date, time]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const payerName = payers.find((p) => p.id === payerId)?.name ?? null;
  const phaseIdx = phase === "done" ? PHASES.length : PHASES.indexOf(phase);

  const submitDetails = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("A valid email is required.");
      return;
    }
    setPhase("estimate");
  };

  const book = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practitionerId,
          serviceId: service.id,
          date,
          time,
          firstName: first,
          lastName: last,
          email,
          phone,
          payerId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not complete your booking. Please try again.");
        if (res.status === 409) setPhase("time"); // slot just taken — re-pick
        return;
      }
      setPhase("done");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Book an appointment"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-scrim"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mkt-rise mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-card bg-surface shadow-menu"
      >
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          {phase !== "time" && phase !== "done" && (
            <button
              type="button"
              onClick={() => setPhase(phase === "estimate" ? "details" : "time")}
              aria-label="Back"
              className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-text-body transition-colors hover:bg-canvas hover:text-text"
            >
              <Icon name="arrow-left" size={18} />
            </button>
          )}
          <h2 className="text-[17px] font-semibold text-text">
            {phase === "done" ? "You're booked" : "Book an appointment"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-text-body transition-colors hover:bg-canvas hover:text-text"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {phase === "time" && (
            <div key="time" className="mkt-rise">
              <p className="text-[15px] text-text-body">
                You&apos;ve selected <span className="font-semibold text-text">{prettyDateTime(date, time)}</span> for{" "}
                {service.telehealth ? (
                  <>
                    a <span className="font-semibold text-text">virtual</span> session
                  </>
                ) : (
                  <>
                    an <span className="font-semibold text-text">in-office</span> session
                  </>
                )}
              </p>

              <div className="mt-4 rounded-card bg-canvas p-4">
                <p className="text-[15px] font-semibold text-text">Book with confidence</p>
                <ul className="mt-2.5 space-y-2">
                  {CONFIDENCE.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-[14px] text-text-body">
                      <Icon name="circle-check" size={16} className="mt-0.5 shrink-0 text-primary" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-4 text-[13px] text-text-muted">
                When you enter your info, we&apos;ll use it to verify your insurance coverage. By continuing you agree
                to Leuk&apos;s cancellation policy and terms of service.
              </p>

              {error && <p className="mt-3 text-sm text-danger">{error}</p>}

              <Button size="xl" fullWidth className="mt-5" onClick={() => setPhase("details")}>
                Continue
              </Button>
            </div>
          )}

          {phase === "details" && (
            <form key="details" className="mkt-rise space-y-4" onSubmit={submitDetails}>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Legal first name"
                  name="firstName"
                  autoComplete="given-name"
                  required
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  placeholder="First name"
                />
                <Field
                  label="Legal last name"
                  name="lastName"
                  autoComplete="family-name"
                  required
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                  placeholder="Last name"
                />
              </div>
              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Field
                label="Mobile phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="xxx-xxx-xxxx"
              />
              <Select
                label="Insurance"
                options={[
                  { value: SELF_PAY, label: "Cash / self-pay (out of network)" },
                  ...payers.map((p) => ({ value: p.id, label: p.name })),
                ]}
                value={payerId}
                onValueChange={setPayerId}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" size="xl" fullWidth>
                Continue
              </Button>
            </form>
          )}

          {phase === "estimate" && (
            <div key="estimate" className="mkt-rise">
              <div className="space-y-3 rounded-card bg-canvas p-4 text-[14px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-body">
                    {service.name} · {service.durationMin} min
                  </span>
                  <span className="font-semibold text-text">{prettyDateTime(date, time)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="text-text-body">{payerName ?? "Cash / self-pay"}</span>
                  <span className="font-semibold text-text">
                    {payerName ? "Copay confirmed before your visit" : formatCents(service.priceCents)}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-[13px] text-text-muted">
                {payerName
                  ? `We'll verify your ${payerName} coverage and confirm your exact cost before the session — most members pay only a copay.`
                  : "Self-pay rate, due after your session. A superbill for out-of-network reimbursement is available on request."}
              </p>

              {error && <p className="mt-3 text-sm text-danger">{error}</p>}

              <Button size="xl" fullWidth className="mt-5" loading={busy} onClick={book}>
                Confirm booking
              </Button>
            </div>
          )}

          {phase === "done" && (
            <div key="done" className="mkt-rise flex flex-col items-center py-4 text-center">
              <Icon name="circle-check" size={44} className="text-success" />
              <p className="mt-3 text-[17px] font-semibold text-text">
                See you {prettyDateTime(date, time)}
              </p>
              <p className="mt-1.5 max-w-sm text-[14px] text-text-body">
                A confirmation is on its way to <span className="font-semibold text-text">{email}</span> — it includes
                a link to set up your client portal, where you can manage this appointment and complete your intake
                form.
              </p>
              <Button size="xl" className="mt-5 w-full" onClick={onClose}>
                Done
              </Button>
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 pb-5 pt-3">
          <div className="flex gap-1.5">
            {PHASES.map((p, i) => (
              <div key={p} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-colors ${i <= phaseIdx ? "bg-primary" : "bg-border"}`}
                />
                <p
                  className={`mt-1.5 text-center text-[12px] ${
                    i <= phaseIdx ? "font-medium text-text" : "text-text-muted"
                  }`}
                >
                  {PHASE_LABELS[p]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

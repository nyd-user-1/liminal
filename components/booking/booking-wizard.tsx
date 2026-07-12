"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Stepper } from "@/components/ui/stepper";
import { Tag } from "@/components/ui/tag";
import { TextLink } from "@/components/ui/text-link";
import { formatCents } from "@/lib/format";
import type { PractitionerLite } from "@/lib/repos/services";
import { serviceColorHex } from "@/lib/service-colors";
import type { Payer, Service } from "@/lib/types";

// The Leuk booking wizard — chrome-light so it drops into both the /book
// page (wrapped in a card) and the BookingModal (wrapped in the Modal surface).
// Flow: service → date + free slot → contact details → confirm → done. Slots
// come from GET /api/book (availability minus booked); POST /api/book creates
// client-if-new (lead) + the appointment. Styled to the home page: font-display
// headings, warm cards, teal CTAs.

const SELF_PAY = "";
const selfPayOption = { value: SELF_PAY, label: "Cash / self-pay (out of network)" };

const STEPPER_LABELS = ["Time", "Details", "Confirm"];
const stepperIndex: Record<Step, number> = { service: 0, time: 0, details: 1, confirm: 2, done: 2 };

type Step = "service" | "time" | "details" | "confirm" | "done";

const slotLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(0, 0, 0, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const prettyDate = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const heading = "font-display text-[26px] font-bold tracking-tight text-text sm:text-[28px]";

export function BookingWizard({
  services,
  practitioners,
  payers,
  lockedPractitionerId,
  prefill,
  onClose,
}: {
  services: Service[];
  practitioners: PractitionerLite[];
  payers: Payer[];
  lockedPractitionerId: string | null;
  // Handoff from the nav Book dropdown: a day + time (+ service, + insurance
  // already picked on the provider page's rail) so we jump straight to details.
  prefill?: { serviceId?: string; date?: string; time?: string; payerId?: string };
  // Provided by the modal host — surfaces a "Done" action on the success step.
  onClose?: () => void;
}) {
  const jumped = Boolean(prefill?.date && prefill?.time);
  const [step, setStep] = useState<Step>(jumped ? "details" : "service");
  const [serviceId, setServiceId] = useState(jumped ? prefill?.serviceId || services[0]?.id || "" : "");
  const [practitionerId, setPractitionerId] = useState(lockedPractitionerId ?? practitioners[0]?.id ?? "");
  const [date, setDate] = useState(prefill?.date ?? "");
  const [time, setTime] = useState(prefill?.time ?? "");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [payerId, setPayerId] = useState(prefill?.payerId ?? SELF_PAY);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const payerName = payers.find((p) => p.id === payerId)?.name ?? selfPayOption.label;

  const service = services.find((s) => s.id === serviceId);
  const practitioner = practitioners.find((p) => p.id === practitionerId);

  const loadSlots = useCallback(async (pid: string, sid: string, d: string) => {
    setSlots(null);
    setTime("");
    const res = await fetch(
      `/api/book?practitionerId=${encodeURIComponent(pid)}&serviceId=${encodeURIComponent(sid)}&date=${d}`,
    );
    const data = await res.json().catch(() => ({}));
    setSlots(Array.isArray(data.slots) ? data.slots : []);
  }, []);

  useEffect(() => {
    if (date && serviceId && practitionerId) void loadSlots(practitionerId, serviceId, date);
  }, [date, serviceId, practitionerId, loadSlots]);

  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        practitionerId,
        serviceId,
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
    setBusy(false);
    if (!res.ok) {
      if (res.status === 409) {
        setStep("time");
        void loadSlots(practitionerId, serviceId, date);
      }
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }
    setStep("done");
  };

  const back = (to: Step) => (
    <TextLink onClick={() => setStep(to)} className="text-sm">
      ← Back
    </TextLink>
  );

  const summary = (
    <div className="divide-y divide-page-edge rounded-card border border-page-edge bg-canvas/40">
      {[
        ["Service", service ? `${service.name} · ${service.durationMin} mins · ${formatCents(service.priceCents)}` : "—"],
        ["Practitioner", practitioner?.name ?? "—"],
        ["When", date && time ? `${prettyDate(date)} at ${slotLabel(time)}` : "—"],
        ["Where", service?.telehealth ? "Telehealth — video link by email" : "Union Square Office, 31 E 17th St"],
        ["Insurance", payerName],
      ].map(([label, value]) => (
        <div key={label} className="flex gap-3 px-4 py-3 text-[15px]">
          <span className="w-28 shrink-0 text-text-muted">{label}</span>
          <span className="font-medium text-text">{value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {step !== "done" && <Stepper steps={STEPPER_LABELS} active={stepperIndex[step]} className="mb-7" />}

      {step === "service" && (
        <div key="service" className="mkt-rise">
          <h2 className={heading}>Book an appointment</h2>
          <p className="mt-1.5 text-[15px] text-text-body">Choose the type of visit to get started.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setServiceId(s.id);
                  setStep("time");
                }}
                className="group flex items-start gap-3 rounded-card border border-page-edge bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-card"
              >
                <span
                  className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ background: serviceColorHex(s.color) }}
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-text">
                    {s.name}
                    {s.telehealth && (
                      <Tag hue="teal">
                        <Icon name="video" size={12} /> Telehealth
                      </Tag>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-text-muted">
                    {s.durationMin} mins · {formatCents(s.priceCents)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "time" && service && (
        <div key="time" className="mkt-rise">
          {back("service")}
          <h2 className={`mt-2 ${heading}`}>Pick a date &amp; time</h2>
          <p className="mt-1.5 text-[15px] text-text-body">
            {service.name} · {service.durationMin} mins · {formatCents(service.priceCents)}
          </p>
          <div className="mt-5 flex flex-wrap gap-4">
            {!lockedPractitionerId && practitioners.length > 1 && (
              <Select
                className="min-w-[12rem]"
                label="Practitioner"
                options={practitioners.map((p) => ({ value: p.id, label: p.name }))}
                value={practitionerId}
                onValueChange={setPractitionerId}
              />
            )}
            <Select
              className="min-w-[12rem]"
              label="Insurance"
              options={[selfPayOption, ...payers.map((p) => ({ value: p.id, label: p.name }))]}
              value={payerId}
              onValueChange={setPayerId}
            />
          </div>
          <div className="mt-5 flex flex-col gap-6 sm:flex-row">
            <DatePicker value={date} onChange={setDate} className="sm:w-64 sm:shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-sm font-medium text-text-body">
                {date ? `Available times · ${prettyDate(date)}` : "Select a date to see available times."}
              </p>
              {date && slots === null && <Spinner className="mt-2 text-primary" />}
              {date && slots !== null && slots.length === 0 && (
                <p className="text-[15px] text-text-muted">No availability on this day — try another date.</p>
              )}
              {date && slots !== null && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                  {slots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTime(s)}
                      className={`rounded-field border px-2 py-2 text-sm font-medium transition-colors ${
                        time === s
                          ? "border-primary bg-teal-100 text-primary"
                          : "border-field-border text-text-body hover:border-primary hover:text-primary"
                      }`}
                    >
                      {slotLabel(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-7 flex justify-end">
            <Button disabled={!date || !time} onClick={() => setStep("details")}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "details" && (
        <div key="details" className="mkt-rise">
          {back("time")}
          <h2 className={`mt-2 ${heading}`}>Your details</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="First name" required value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" />
            <Field label="Last name" required value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
            <Field label="Email" required type="email" className="sm:col-span-2" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <Field label="Phone" type="tel" className="sm:col-span-2" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" hint="Optional" />
          </div>
          <div className="mt-7 flex justify-end">
            <Button
              disabled={!first.trim() || !last.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
              onClick={() => setStep("confirm")}
            >
              Review booking
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div key="confirm" className="mkt-rise">
          {back("details")}
          <h2 className={`mt-2 ${heading}`}>Confirm your appointment</h2>
          <div className="mt-6 space-y-4">
            {summary}
            <p className="text-sm text-text-muted">
              Booking as {first} {last} · {email}
              {phone ? ` · ${phone}` : ""}
            </p>
            {error && <p className="text-[13px] text-danger">{error}</p>}
          </div>
          <div className="mt-7 flex justify-end">
            <Button loading={busy} onClick={submit}>
              Confirm booking
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div key="done" className="mkt-rise py-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-tint text-success">
            <Icon name="check" size={28} />
          </span>
          <h2 className={`mt-4 ${heading}`}>You&apos;re booked!</h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-text-body">
            {service?.name} with {practitioner?.name} on {prettyDate(date)} at {slotLabel(time)}. A confirmation is on its
            way to {email}.{service?.telehealth ? " Your video link will arrive before the visit." : ""}
          </p>
          {onClose && (
            <Button className="mx-auto mt-6" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

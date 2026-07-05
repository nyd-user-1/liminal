"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { SidePanel } from "@/components/ui/side-panel";
import { Tag } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import { formatCents, formatDateLong, formatTime } from "@/lib/format";
import type { ClientLite } from "@/lib/repos/appointments";
import type { PractitionerLite } from "@/lib/repos/services";
import { serviceColorHex } from "@/lib/service-colors";
import type { Appointment, AppointmentStatus, Location, Service } from "@/lib/types";
import { toHHMM } from "./calendar-utils";

// SidePanel detail (click a chip) + SidePanel form (click/drag empty grid or
// "+ New") for appointments.

export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; variant: "neutral" | "success" | "warning" | "danger" | "info" }
> = {
  scheduled: { label: "Scheduled", variant: "neutral" },
  confirmed: { label: "Confirmed", variant: "info" },
  arrived: { label: "Arrived", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
  no_show: { label: "No show", variant: "warning" },
};

const STATUS_OPTIONS = (Object.keys(STATUS_META) as AppointmentStatus[]).map((s) => ({
  value: s,
  label: STATUS_META[s].label,
}));

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="w-28 shrink-0 pt-0.5 text-sm font-medium text-text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-[15px] text-text">{children}</span>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

export function AppointmentDetailPanel({
  appointment,
  client,
  service,
  location,
  practitioner,
  onClose,
  onStatusChange,
  onCancel,
}: {
  appointment: Appointment | null;
  client?: ClientLite;
  service?: Service;
  location?: Location;
  practitioner?: PractitionerLite;
  onClose: () => void;
  onStatusChange: (id: string, status: AppointmentStatus) => Promise<void>;
  onCancel: (id: string, reason: string) => Promise<void>;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCancelling(false);
    setReason("");
  }, [appointment?.id]);

  if (!appointment) return null;
  const a = appointment;
  const meta = STATUS_META[a.status];
  const telehealth = !!service?.telehealth;

  return (
    <SidePanel
      open
      onClose={onClose}
      title="Appointment"
      icon="calendar"
      footer={
        a.status === "cancelled" ? undefined : cancelling ? (
          <>
            <Button variant="secondary" onClick={() => setCancelling(false)}>
              Keep appointment
            </Button>
            <Button
              variant="danger-solid"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await onCancel(a.id, reason.trim() || "Cancelled by staff");
                setBusy(false);
              }}
            >
              Confirm cancellation
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setCancelling(true)}>
            Cancel appointment
          </Button>
        )
      }
    >
      {/* identity block */}
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={client?.name ?? "Client"} hue="teal" size="md" />
        <div className="min-w-0">
          <p className="truncate text-[19px] font-semibold text-text">{client?.name ?? "Client"}</p>
          <p className="text-sm text-text-muted">
            {formatDateLong(a.startsAt)} · {formatTime(a.startsAt)} – {formatTime(a.endsAt)}
          </p>
        </div>
        <Badge variant={meta.variant} className="ml-auto">
          {meta.label}
        </Badge>
      </div>

      {telehealth && a.status !== "cancelled" && (
        <Link href={`/calls/${a.id}`} className="mb-4 block">
          <Button leftIcon="video" fullWidth>
            Join video call
          </Button>
        </Link>
      )}

      <div className="divide-y divide-border rounded-card border border-border px-4 py-1">
        <DetailRow label="Service">
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: serviceColorHex(service?.color ?? "teal") }}
            />
            {service?.name ?? "Service"}
            <span className="text-text-muted">
              · {service ? `${service.durationMin} mins · ${formatCents(service.priceCents)}` : ""}
            </span>
          </span>
        </DetailRow>
        <DetailRow label="Practitioner">{practitioner?.name ?? "—"}</DetailRow>
        <DetailRow label="Location">
          <span className="inline-flex items-center gap-1.5">
            {location?.kind === "telehealth" && <Icon name="video" size={15} className="text-text-muted" />}
            {location?.name ?? "—"}
          </span>
        </DetailRow>
        <DetailRow label="Booked via">
          <Tag>{a.bookedVia === "staff" ? "Staff" : a.bookedVia === "portal" ? "Client portal" : "Booking link"}</Tag>
        </DetailRow>
        {a.notesBrief && <DetailRow label="Notes">{a.notesBrief}</DetailRow>}
        {a.cancelledReason && <DetailRow label="Cancelled">{a.cancelledReason}</DetailRow>}
      </div>

      {a.status !== "cancelled" && (
        <div className="mt-5">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={a.status}
            onValueChange={(v) => onStatusChange(a.id, v as AppointmentStatus)}
          />
          <p className="mt-2 text-[13px] text-text-muted">
            Tip: drag the chip on the calendar to reschedule.
          </p>
        </div>
      )}

      {cancelling && (
        <Textarea
          className="mt-5"
          label="Cancellation reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Client requested reschedule"
          rows={3}
        />
      )}
    </SidePanel>
  );
}

// ── Create panel ──────────────────────────────────────────────────────────────

export interface CreateDraft {
  date: string; // YYYY-MM-DD
  startMin: number;
  endMin?: number; // set when drag-created
  practitionerId?: string;
}

export function AppointmentFormPanel({
  draft,
  clients,
  services,
  locations,
  practitioners,
  onClose,
  onCreate,
}: {
  draft: CreateDraft | null;
  clients: ClientLite[];
  services: Service[];
  locations: Location[];
  practitioners: PractitionerLite[];
  onClose: () => void;
  onCreate: (input: {
    clientId: string;
    practitionerId: string;
    serviceId: string;
    locationId: string | null;
    startsAt: string;
    endsAt: string;
    notesBrief: string | null;
  }) => Promise<boolean>;
}) {
  const activeServices = services.filter((s) => s.active);
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [practitionerId, setPractitionerId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Re-seed the form each time a new draft opens.
  useEffect(() => {
    if (!draft) return;
    setClientId("");
    setServiceId("");
    setPractitionerId(draft.practitionerId ?? practitioners[0]?.id ?? "");
    setLocationId(locations.find((l) => l.kind === "office")?.id ?? locations[0]?.id ?? "");
    setDate(draft.date);
    setTime(toHHMM(draft.startMin));
    setDuration(draft.endMin ? draft.endMin - draft.startMin : 30);
    setNotes("");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  if (!draft) return null;

  const pickService = (id: string) => {
    setServiceId(id);
    const svc = activeServices.find((s) => s.id === id);
    if (!svc) return;
    // Duration follows the service unless the slot was drag-sized.
    if (!draft.endMin) setDuration(svc.durationMin);
    const tele = locations.find((l) => l.kind === "telehealth");
    const office = locations.find((l) => l.kind === "office");
    setLocationId((svc.telehealth ? (tele ?? office) : (office ?? tele))?.id ?? "");
  };

  const submit = async () => {
    if (!clientId || !serviceId || !practitionerId || !date || !time) {
      setError("Client, service, practitioner, date and time are required.");
      return;
    }
    setError("");
    setBusy(true);
    const starts = new Date(`${date}T${time}:00`);
    const ends = new Date(starts.getTime() + duration * 60_000);
    const ok = await onCreate({
      clientId,
      practitionerId,
      serviceId,
      locationId: locationId || null,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      notesBrief: notes.trim() || null,
    });
    setBusy(false);
    if (!ok) setError("Could not create the appointment. Please try again.");
  };

  return (
    <SidePanel
      open
      onClose={onClose}
      title="New appointment"
      icon="calendar"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Create appointment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Client"
          required
          searchable
          placeholder="Search clients…"
          options={clients.map((c) => ({
            value: c.id,
            label: c.status === "lead" ? `${c.name} (lead)` : c.name,
          }))}
          value={clientId}
          onValueChange={setClientId}
        />
        <Select
          label="Service"
          required
          searchable
          placeholder="Select a service…"
          options={activeServices.map((s) => ({
            value: s.id,
            label: `${s.name} · ${s.durationMin} mins · ${formatCents(s.priceCents)}`,
            color: serviceColorHex(s.color),
          }))}
          value={serviceId}
          onValueChange={pickService}
        />
        <Select
          label="Practitioner"
          required
          options={practitioners.map((p) => ({ value: p.id, label: p.name }))}
          value={practitionerId}
          onValueChange={setPractitionerId}
        />
        <Select
          label="Location"
          placeholder="No location"
          options={locations.map((l) => ({ value: l.id, label: l.name }))}
          value={locationId}
          onValueChange={setLocationId}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field label="Start time" required type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <Field
          label="Duration"
          type="number"
          min={5}
          step={5}
          suffix="mins"
          value={String(duration)}
          onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || 30))}
          hint="Auto-filled from the service."
        />
        <Textarea
          label="Notes (brief)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional"
        />
        {error && <p className="text-[13px] text-danger">{error}</p>}
      </div>
    </SidePanel>
  );
}

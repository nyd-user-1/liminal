"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSquare } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatDateLong, formatTime } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/types";

export interface PortalAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  videoRoom: string | null;
  serviceId: string;
  practitionerId: string;
  serviceName: string;
  practitionerName: string;
  locationName: string | null;
}

const STATUS: Record<AppointmentStatus, { label: string; variant: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  scheduled: { label: "Scheduled", variant: "info" },
  confirmed: { label: "Confirmed", variant: "success" },
  arrived: { label: "Arrived", variant: "info" },
  completed: { label: "Completed", variant: "neutral" },
  cancelled: { label: "Cancelled", variant: "danger" },
  no_show: { label: "No show", variant: "warning" },
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Reschedule dialog: pick a day, then a free slot (live from /api/book). */
function RescheduleModal({
  appointment,
  onClose,
  onDone,
}: {
  appointment: PortalAppointment;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(todayKey());
  const [slots, setSlots] = useState<string[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let stale = false;
    setSlots(null);
    setTime(null);
    fetch(`/api/book?practitionerId=${appointment.practitionerId}&serviceId=${appointment.serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (!stale) setSlots(Array.isArray(d.slots) ? d.slots : []);
      })
      .catch(() => {
        if (!stale) setSlots([]);
      });
    return () => {
      stale = true;
    };
  }, [date, appointment.practitionerId, appointment.serviceId]);

  const submit = async () => {
    if (!time) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reschedule", date, time }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not reschedule.", "danger");
        return;
      }
      toast("Appointment rescheduled — confirmation email on its way.", "success");
      onDone();
    } catch {
      toast("Something went wrong. Please try again.", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Reschedule appointment"
      icon="calendar-check"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep current time
          </Button>
          <Button onClick={submit} disabled={!time} loading={saving}>
            Confirm new time
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[15px] text-text-body">
        Currently {formatDateLong(appointment.startsAt)} · {formatTime(appointment.startsAt)} with{" "}
        {appointment.practitionerName}.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <DatePicker value={date} onChange={setDate} />
        <div>
          <p className="mb-2 text-sm font-medium text-text">Available times</p>
          {slots === null ? (
            <Spinner />
          ) : slots.length === 0 ? (
            <p className="text-sm text-text-muted">No openings this day — try another date.</p>
          ) : (
            <div className="flex max-h-56 flex-wrap content-start gap-2 overflow-y-auto">
              {slots.map((s) => (
                <ChoiceChip key={s} label={s} selected={time === s} onSelect={() => setTime(s)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function AppointmentsList({
  appointments,
  bookHref,
}: {
  appointments: PortalAppointment[];
  bookHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [rescheduling, setRescheduling] = useState<PortalAppointment | null>(null);
  const [cancelling, setCancelling] = useState<PortalAppointment | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const now = Date.now();

  const upcoming = appointments.filter((a) => new Date(a.endsAt).getTime() >= now);
  const past = appointments.filter((a) => new Date(a.endsAt).getTime() < now).reverse();
  const visible = tab === "upcoming" ? upcoming : past;

  const confirmCancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      const res = await fetch(`/api/portal/appointments/${cancelling.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not cancel.", "danger");
        return;
      }
      toast("Appointment cancelled.", "success");
      setCancelling(null);
      router.refresh();
    } catch {
      toast("Something went wrong. Please try again.", "danger");
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <>
      <TopBarActions>
        <Link href={bookHref}>
          <Button size="sm" leftIcon="plus">Book appointment</Button>
        </Link>
      </TopBarActions>

      <Tabs
        className="mb-4"
        items={[
          { key: "upcoming", label: "Upcoming", count: upcoming.length },
          { key: "past", label: "Past", count: past.length },
        ]}
        active={tab}
        onChange={(k) => setTab(k as "upcoming" | "past")}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon="calendar-check"
          title={tab === "upcoming" ? "No upcoming appointments" : "No past appointments"}
          subtext={tab === "upcoming" ? "Book a time that works for you — no phone tag required." : undefined}
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map((a) => {
            const s = STATUS[a.status];
            const joinable = tab === "upcoming" && !!a.videoRoom && a.status !== "cancelled" && a.status !== "no_show";
            const changeable =
              tab === "upcoming" &&
              (a.status === "scheduled" || a.status === "confirmed") &&
              new Date(a.startsAt).getTime() > now;
            return (
              <ListRow
                key={a.id}
                stackTrailing={joinable || changeable}
                leading={<IconSquare name={a.videoRoom ? "video" : "calendar-check"} />}
                title={
                  <>
                    {a.serviceName}
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </>
                }
                meta={
                  <>
                    {formatDateLong(a.startsAt)} · {formatTime(a.startsAt)}–{formatTime(a.endsAt)} · {a.practitionerName}
                    {a.locationName ? ` · ${a.locationName}` : ""}
                  </>
                }
                trailing={
                  joinable || changeable ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {changeable && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => setRescheduling(a)}>
                            Reschedule
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setCancelling(a)}>
                            Cancel
                          </Button>
                        </>
                      )}
                      {joinable && (
                        <Link href={`/portal/call/${a.videoRoom}`}>
                          <Button size="sm" leftIcon="video">Join video call</Button>
                        </Link>
                      )}
                    </div>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}

      {rescheduling && (
        <RescheduleModal
          appointment={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null);
            router.refresh();
          }}
        />
      )}

      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel this appointment?"
        icon="calendar-check"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              Keep appointment
            </Button>
            <Button variant="danger-solid" onClick={confirmCancel} loading={cancelBusy}>
              Cancel appointment
            </Button>
          </>
        }
      >
        {cancelling && (
          <p className="text-[15px] text-text-body">
            {cancelling.serviceName} on {formatDateLong(cancelling.startsAt)} at {formatTime(cancelling.startsAt)} with{" "}
            {cancelling.practitionerName} will be cancelled and your care team notified.
          </p>
        )}
      </Modal>
    </>
  );
}

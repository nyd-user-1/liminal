"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { DatePicker } from "@/components/ui/date-picker";
import { Divider } from "@/components/ui/divider";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatDateLong, formatTime } from "@/lib/format";
import { SERVICE_COLOR_SLOTS } from "@/lib/service-colors";
import type { AppointmentStatus } from "@/lib/types";
import { addDays, dateKey, minutesOfDay, parseKey, startOfWorkWeek } from "@/app/(app)/calendar/calendar-utils";
import { MonthGrid } from "@/app/(app)/calendar/month-grid";
import { WeekGrid, type CalEvent } from "@/app/(app)/calendar/week-grid";

// Portal Appointments — the provider calendar's two-pane shell from a client's
// point of view. Left: "My appointments" (upcoming / past) as a day-grouped
// agenda list — the same pattern as the provider calendar rail — where a row
// opens a detail modal carrying reschedule / cancel / join; plus a mini-month
// at lg+. Right (lg+ only): the same Week / Month calendar grid, read-only,
// reflecting just this client's sessions. Below lg the list is primary
// (clients are on phones) and the grid is hidden.

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

const todayKey = () => dateKey(new Date());

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
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => dateKey(new Date()));
  const [detailId, setDetailId] = useState<string | null>(null);
  const now = Date.now();

  const upcoming = appointments.filter((a) => new Date(a.endsAt).getTime() >= now);
  const past = appointments.filter((a) => new Date(a.endsAt).getTime() < now).reverse();
  const visible = tab === "upcoming" ? upcoming : past;

  // Colour each practitioner distinctly (stable slot by first-seen order).
  const practitionerColor = useMemo(() => {
    const ids = [...new Set(appointments.map((a) => a.practitionerId))];
    return new Map(ids.map((id, i) => [id, SERVICE_COLOR_SLOTS[i % SERVICE_COLOR_SLOTS.length].hex]));
  }, [appointments]);

  // Calendar events — every non-cancelled session; the chip title is the
  // practitioner (who the client is seeing), past sessions render dimmed.
  const events: CalEvent[] = useMemo(
    () =>
      appointments
        .filter((a) => a.status !== "cancelled")
        .map((a) => ({
          id: a.id,
          date: dateKey(new Date(a.startsAt)),
          startMin: minutesOfDay(a.startsAt),
          endMin: Math.max(minutesOfDay(a.startsAt) + 15, minutesOfDay(a.endsAt)),
          title: a.practitionerName,
          timeLabel: `${formatTime(a.startsAt)} – ${formatTime(a.endsAt)}`,
          color: practitionerColor.get(a.practitionerId) ?? SERVICE_COLOR_SLOTS[0].hex,
          telehealth: !!a.videoRoom,
          icon: a.videoRoom ? ("video" as const) : undefined,
          status: a.status,
          muted: a.status === "completed" || a.status === "no_show",
        })),
    [appointments, practitionerColor],
  );

  const days = useMemo(() => {
    const start = startOfWorkWeek(anchor);
    return Array.from({ length: 5 }, (_, i) => addDays(start, i));
  }, [anchor]);

  // Group the visible list by day — the provider calendar's "Agenda" rail:
  // a short weekday/date header over compact rows (ascending upcoming,
  // most-recent-first for past).
  const grouped = useMemo(() => {
    const byDay = new Map<string, PortalAppointment[]>();
    for (const a of visible) {
      const k = dateKey(new Date(a.startsAt));
      const bucket = byDay.get(k);
      if (bucket) bucket.push(a);
      else byDay.set(k, [a]);
    }
    const keys = [...byDay.keys()].sort();
    if (tab === "past") keys.reverse();
    return keys.map((k) => ({
      key: k,
      label: parseKey(k).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      items: byDay.get(k)!.sort((x, y) => {
        const d = minutesOfDay(x.startsAt) - minutesOfDay(y.startsAt);
        return tab === "past" ? -d : d;
      }),
    }));
  }, [visible, tab]);

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

  const canChange = (a: PortalAppointment) =>
    (a.status === "scheduled" || a.status === "confirmed") && new Date(a.startsAt).getTime() > now;
  const canJoin = (a: PortalAppointment) => !!a.videoRoom && a.status !== "cancelled" && a.status !== "no_show";

  // Agenda-style row (matches the provider calendar rail): a practitioner
  // colour bar, service + status, and a time · practitioner meta line. Clicking
  // opens the shared detail modal, where Reschedule / Cancel / Join live.
  const agendaItem = (a: PortalAppointment) => {
    const s = STATUS[a.status];
    const color = practitionerColor.get(a.practitionerId) ?? SERVICE_COLOR_SLOTS[0].hex;
    const muted = a.status === "cancelled" || a.status === "completed" || a.status === "no_show";
    return (
      <button
        key={a.id}
        type="button"
        onClick={() => setDetailId(a.id)}
        className={`flex w-full items-stretch gap-2.5 rounded-field px-2 py-2 text-left transition-colors hover:bg-canvas ${
          muted ? "opacity-70" : ""
        }`}
      >
        <span className="w-1 shrink-0 rounded-full" style={{ background: color }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">{a.serviceName}</span>
            <Badge variant={s.variant} className="shrink-0">
              {s.label}
            </Badge>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-text-muted">
            <Icon name={a.videoRoom ? "video" : "map-pin"} size={14} className="shrink-0 text-text-muted" />
            <span className="truncate">
              {formatTime(a.startsAt)}–{formatTime(a.endsAt)} · {a.practitionerName}
            </span>
          </span>
        </span>
      </button>
    );
  };

  const appointmentList = (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs
        className="mb-4 shrink-0"
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
        <div className="min-h-0 flex-1 space-y-3 lg:overflow-y-auto">
          {grouped.map((group) => (
            <div key={group.key}>
              <p className="mb-1 text-[13px] font-semibold text-text-muted">{group.label}</p>
              <div className="space-y-0.5">{group.items.map(agendaItem)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const detail = detailId ? appointments.find((a) => a.id === detailId) ?? null : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBarActions>
        <Link href={bookHref}>
          <Button size="sm" leftIcon="plus">Book appointment</Button>
        </Link>
      </TopBarActions>

      {/* Grid controls — only relevant to the calendar, hidden below lg */}
      <div className="mb-4 hidden items-center justify-end gap-2 lg:flex">
        <Button variant="secondary" onClick={() => setAnchor(dateKey(new Date()))}>
          Today
        </Button>
        <Select
          aria-label="Calendar view"
          className="w-28"
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          value={view}
          onValueChange={(v) => setView(v as "week" | "month")}
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left — my appointments (full width below lg; a rail with mini-month at lg) */}
        <aside className="flex min-h-0 w-full flex-col gap-4 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:rounded-card lg:border lg:border-border lg:bg-surface lg:p-4 lg:shadow-card">
          <div className="hidden lg:block">
            <DatePicker key={anchor.slice(0, 7)} value={anchor} onChange={setAnchor} />
            <Divider className="mt-4" />
          </div>
          {appointmentList}
        </aside>

        {/* Right — read-only calendar grid (lg+ only) */}
        <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card lg:flex">
          {view === "month" ? (
            <MonthGrid
              anchor={anchor}
              events={events}
              onChipClick={setDetailId}
              onDayClick={(date) => {
                setAnchor(date);
                setView("week");
              }}
            />
          ) : (
            <WeekGrid days={days} events={events} onChipClick={setDetailId} readOnly />
          )}
        </div>
      </div>

      {/* Chip-click detail — read-only summary + the same actions as the list */}
      {detail && (
        <Modal
          open
          onClose={() => setDetailId(null)}
          title={detail.serviceName}
          icon={detail.videoRoom ? "video" : "calendar-check"}
          footer={
            canChange(detail) || canJoin(detail) ? (
              <>
                {canChange(detail) && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setRescheduling(detail);
                        setDetailId(null);
                      }}
                    >
                      Reschedule
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setCancelling(detail);
                        setDetailId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
                {canJoin(detail) && (
                  <Link href={`/portal/call/${detail.videoRoom}`}>
                    <Button leftIcon="video">Join video call</Button>
                  </Link>
                )}
              </>
            ) : undefined
          }
        >
          <div className="space-y-1.5 text-[15px] text-text-body">
            <p className="flex items-center gap-2">
              <Badge variant={STATUS[detail.status].variant}>{STATUS[detail.status].label}</Badge>
            </p>
            <p>
              {formatDateLong(detail.startsAt)} · {formatTime(detail.startsAt)}–{formatTime(detail.endsAt)}
            </p>
            <p>
              with {detail.practitionerName}
              {detail.locationName ? ` · ${detail.locationName}` : ""}
            </p>
          </div>
        </Modal>
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
    </div>
  );
}

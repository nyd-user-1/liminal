"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { DatePicker } from "@/components/ui/date-picker";
import { Divider } from "@/components/ui/divider";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatTime } from "@/lib/format";
import type { Appointment } from "@/lib/types";
import type { Location, Service } from "@/lib/types";
import type { ClientLite, CreateAppointmentInput } from "@/lib/repos/appointments";
import type { PractitionerLite } from "@/lib/repos/services";
import { serviceColorHex } from "@/lib/service-colors";
import {
  addDays,
  dateKey,
  minutesOfDay,

  startOfWeek,
} from "./calendar-utils";
import { AppointmentDetailPanel, AppointmentFormPanel, type CreateDraft } from "./appointment-panels";
import { WeekGrid, type CalEvent } from "./week-grid";

// The flagship calendar surface: Toolbar (Today · prev/next · range label ·
// Day/Week · practitioner filter · + New) + rail (mini-month DatePicker +
// practitioner checkboxes) + WeekGrid + appointment SidePanels.

type Panel = { kind: "detail"; id: string } | { kind: "create"; draft: CreateDraft } | null;

// Leading icon for a calendar session chip, by service type.
function sessionIcon(svc?: Service): IconName | undefined {
  if (svc?.telehealth) return "video";
  const n = svc?.name.toLowerCase() ?? "";
  if (n.includes("therapy")) return "book-heart";
  if (n.includes("follow")) return "corner-down-right";
  if (n.includes("initial") || n.includes("evaluation")) return "corner-down-right";
  if (n.includes("group")) return "users";
  return undefined;
}

export function CalendarClient({
  initialAppointments,
  clients,
  services,
  locations,
  practitioners,
}: {
  initialAppointments: Appointment[];
  clients: ClientLite[];
  services: Service[];
  locations: Location[];
  practitioners: PractitionerLite[];
}) {
  const toast = useToast();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [view, setView] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState(() => dateKey(new Date()));
  const [visible, setVisible] = useState<Set<string>>(() => new Set(practitioners.map((p) => p.id)));
  const [panel, setPanel] = useState<Panel>(null);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const locationById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const practitionerById = useMemo(() => new Map(practitioners.map((p) => [p.id, p])), [practitioners]);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [view, anchor]);

  const events: CalEvent[] = useMemo(
    () =>
      appointments
        .filter((a) => a.status !== "cancelled" && visible.has(a.practitionerId))
        .map((a) => {
          const svc = serviceById.get(a.serviceId);
          return {
            id: a.id,
            date: dateKey(new Date(a.startsAt)),
            startMin: minutesOfDay(a.startsAt),
            endMin: Math.max(minutesOfDay(a.startsAt) + 15, minutesOfDay(a.endsAt)),
            title: clientById.get(a.clientId)?.name ?? "Client",
            timeLabel: `${formatTime(a.startsAt)} – ${formatTime(a.endsAt)}`,
            color: serviceColorHex(svc?.color ?? "teal"),
            telehealth: !!svc?.telehealth,
            icon: sessionIcon(svc),
            muted: a.status === "completed" || a.status === "no_show",
          };
        }),
    [appointments, visible, serviceById, clientById],
  );

  // Agenda for the selected day (rail list) — same filtering as the grid,
  // narrowed to the anchor date and sorted by start time.
  const dayEvents = useMemo(
    () => events.filter((e) => e.date === anchor).sort((a, b) => a.startMin - b.startMin),
    [events, anchor],
  );

  const dayLabel = useMemo(
    () =>
      new Date(`${anchor}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    [anchor],
  );

  // ── mutations (API + local state) ───────────────────────────────────────────

  const applyPatch = async (id: string, patch: Record<string, unknown>): Promise<Appointment | null> => {
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.appointment) {
      toast(data.error ?? "Could not update the appointment.", "danger");
      return null;
    }
    const updated: Appointment = data.appointment;
    setAppointments((list) => list.map((a) => (a.id === id ? updated : a)));
    return updated;
  };

  const moveAppointment = async (id: string, date: string, startMin: number) => {
    const apt = appointments.find((a) => a.id === id);
    if (!apt) return;
    const durationMs = new Date(apt.endsAt).getTime() - new Date(apt.startsAt).getTime();
    const starts = new Date(`${date}T00:00:00`);
    starts.setMinutes(startMin);
    const updated = await applyPatch(id, {
      startsAt: starts.toISOString(),
      endsAt: new Date(starts.getTime() + durationMs).toISOString(),
    });
    if (updated) toast(`Moved to ${formatTime(updated.startsAt)}.`, "success");
  };

  const changeStatus = async (id: string, status: Appointment["status"]) => {
    const updated = await applyPatch(id, { status });
    if (updated) toast(`Marked ${status.replace("_", " ")}.`, "success");
  };

  const cancelAppointment = async (id: string, reason: string) => {
    const updated = await applyPatch(id, { status: "cancelled", cancelledReason: reason });
    if (updated) {
      toast("Appointment cancelled.", "success");
      setPanel(null);
    }
  };

  const createAppointment = async (input: CreateAppointmentInput): Promise<boolean> => {
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.appointment) return false;
    setAppointments((list) => [...list, data.appointment as Appointment]);
    toast("Appointment created.", "success");
    setPanel(null);
    return true;
  };

  // ── toolbar state helpers ───────────────────────────────────────────────────

  const filterValue = visible.size === practitioners.length ? "all" : visible.size === 1 ? [...visible][0] : "";
  const defaultPractitioner = visible.size >= 1 ? [...visible][0] : practitioners[0]?.id;

  const openCreate = (draft: CreateDraft) =>
    setPanel({ kind: "create", draft: { practitionerId: defaultPractitioner, ...draft } });

  const detail = panel?.kind === "detail" ? appointments.find((a) => a.id === panel.id) ?? null : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Page action lives in the TopBar (canonical rule — CLAUDE.md) */}
      <TopBarActions>
        <Button
          leftIcon="plus"
          onClick={() => {
            const now = new Date();
            openCreate({ date: dateKey(now), startMin: Math.min(19 * 60, (now.getHours() + 1) * 60) });
          }}
        >
          New
        </Button>
      </TopBarActions>

      {/* Toolbar (catalog `Toolbar calendar` variant) — anchor date · Today ·
          view · practitioner. Date navigation lives in the rail DatePicker. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-4">
        {/* Left column — mirrors the rail width so date + Today sit above it */}
        <div className="flex items-center gap-2 lg:w-80 lg:shrink-0">
          <Button variant="secondary" onClick={() => setAnchor(dateKey(new Date()))}>
            Today
          </Button>
        </div>
        {/* Right column — flex-1 so Week + practitioners align with the grid */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select
            aria-label="Calendar view"
            className="w-28"
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
            ]}
            value={view}
            onValueChange={(v) => setView(v as "day" | "week")}
          />
          <Select
            aria-label="Practitioner filter"
            className="w-52"
            placeholder="Some practitioners"
            options={[
              { value: "all", label: "All practitioners" },
              ...practitioners.map((p) => ({ value: p.id, label: p.name })),
            ]}
            value={filterValue}
            onValueChange={(v) =>
              setVisible(v === "all" || v === "" ? new Set(practitioners.map((p) => p.id)) : new Set([v]))
            }
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Rail: mini month + practitioner filter */}
        {/* w-80: DatePicker (w-64) + p-4 + borders need 290px — w-72 overflowed
            by 2px and rendered a horizontal scrollbar (always-show setting) */}
        <aside className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto rounded-card border border-border bg-surface p-4 shadow-card lg:flex">
          {/* key remounts the mini-month so its view follows the anchor; its
              own ‹ › arrows are THE calendar navigation (single source) */}
          <DatePicker key={anchor.slice(0, 7)} value={anchor} onChange={setAnchor} />
          <Divider />
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[13px] font-semibold text-text-muted">{dayLabel}</p>
              <span className="text-[13px] text-text-muted">
                {dayEvents.length} {dayEvents.length === 1 ? "appt" : "appts"}
              </span>
            </div>
            {dayEvents.length === 0 ? (
              <p className="rounded-field bg-canvas px-3 py-6 text-center text-sm text-text-muted">
                No appointments
              </p>
            ) : (
              <div className="space-y-0.5 overflow-y-auto">
                {dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setPanel({ kind: "detail", id: ev.id })}
                    className={`flex w-full items-center gap-2.5 rounded-field px-2 py-2 text-left transition-colors hover:bg-canvas ${ev.muted ? "opacity-60" : ""}`}
                  >
                    <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: ev.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-text">{ev.title}</span>
                      <span className="block truncate text-[13px] text-text-muted">{ev.timeLabel}</span>
                    </span>
                    {ev.icon && <Icon name={ev.icon} size={16} className="shrink-0 text-text-muted" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Grid */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <WeekGrid
            days={days}
            events={events}
            onChipClick={(id) => setPanel({ kind: "detail", id })}
            onSlotClick={(date, startMin) => openCreate({ date, startMin })}
            onDragCreate={(date, startMin, endMin) => openCreate({ date, startMin, endMin })}
            onMove={moveAppointment}
          />
        </div>
      </div>

      {/* Panels */}
      {detail && (
        <AppointmentDetailPanel
          appointment={detail}
          client={clientById.get(detail.clientId)}
          service={serviceById.get(detail.serviceId)}
          location={detail.locationId ? locationById.get(detail.locationId) : undefined}
          practitioner={practitionerById.get(detail.practitionerId)}
          onClose={() => setPanel(null)}
          onStatusChange={changeStatus}
          onCancel={cancelAppointment}
        />
      )}
      <AppointmentFormPanel
        draft={panel?.kind === "create" ? panel.draft : null}
        clients={clients}
        services={services}
        locations={locations}
        practitioners={practitioners}
        onClose={() => setPanel(null)}
        onCreate={createAppointment}
      />
    </div>
  );
}

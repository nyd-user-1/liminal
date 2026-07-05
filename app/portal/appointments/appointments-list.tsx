"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSquare } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { Tabs } from "@/components/ui/tabs";
import { formatDateLong, formatTime } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/types";

export interface PortalAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  videoRoom: string | null;
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

export function AppointmentsList({ appointments }: { appointments: PortalAppointment[] }) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const now = Date.now();

  const upcoming = appointments.filter((a) => new Date(a.endsAt).getTime() >= now);
  const past = appointments.filter((a) => new Date(a.endsAt).getTime() < now).reverse();
  const visible = tab === "upcoming" ? upcoming : past;

  return (
    <>
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
          subtext={tab === "upcoming" ? "Your care team will book with you." : undefined}
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map((a) => {
            const s = STATUS[a.status];
            const joinable = tab === "upcoming" && !!a.videoRoom && a.status !== "cancelled" && a.status !== "no_show";
            return (
              <ListRow
                key={a.id}
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
                  joinable ? (
                    <Link href={`/portal/call/${a.videoRoom}`}>
                      <Button size="sm" leftIcon="video">Join video call</Button>
                    </Link>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}

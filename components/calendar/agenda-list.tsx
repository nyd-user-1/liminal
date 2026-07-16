"use client";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { STATUS_META } from "@/app/(app)/calendar/appointment-panels";
import type { AppointmentStatus } from "@/lib/types";

// The agenda list — extracted verbatim from the calendar's right rail so the
// same rows can be rendered anywhere. It was inline in calendar-client.tsx;
// /analytics needs the identical list for its "Next up" card, and two agendas
// that drift apart is exactly the bug this extraction prevents.
//
// Presentational only: grouping/filtering stays with the caller (the calendar
// groups by its day/week/month range; the analytics card passes one group).

export interface AgendaItem {
  id: string;
  title: string;
  timeLabel: string;
  status: AppointmentStatus;
  /** Service colour — the 4px leading band. Falls back to the border token. */
  color?: string;
  telehealth?: boolean;
}

export interface AgendaGroup {
  key: string;
  label: string;
  items: AgendaItem[];
}

export function AgendaList({
  groups,
  onSelect,
  emptyText = "No upcoming appointments",
}: {
  groups: AgendaGroup[];
  onSelect?: (id: string) => void;
  emptyText?: string;
}) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  if (total === 0) {
    return <p className="rounded-field bg-canvas px-3 py-6 text-center text-sm text-text-muted">{emptyText}</p>;
  }
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
      {groups.map((group) => (
        <div key={group.key}>
          {group.label && <p className="mb-1 text-[13px] font-semibold text-text-muted">{group.label}</p>}
          <div className="space-y-0.5">
            {group.items.map((ev) => {
              const Row = onSelect ? "button" : "div";
              return (
                <Row
                  key={ev.id}
                  {...(onSelect ? { type: "button" as const, onClick: () => onSelect(ev.id) } : {})}
                  className={`flex w-full items-stretch gap-2.5 rounded-field px-2 py-2 text-left ${
                    onSelect ? "transition-colors hover:bg-canvas" : ""
                  }`}
                >
                  <span className="w-1 shrink-0 rounded-full" style={{ background: ev.color ?? "var(--color-border)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">{ev.title}</span>
                      <Badge variant={STATUS_META[ev.status].variant} className="shrink-0">
                        {STATUS_META[ev.status].label}
                      </Badge>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-text-muted">
                      <Icon name={ev.telehealth ? "video" : "map-pin"} size={14} className="shrink-0 text-text-muted" />
                      <span className="truncate">{ev.timeLabel}</span>
                    </span>
                  </span>
                </Row>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

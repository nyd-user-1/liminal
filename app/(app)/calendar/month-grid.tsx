"use client";

import { Icon } from "@/components/ui/icons";
import type { CalEvent } from "./week-grid";
import { dateKey, monthMatrix, monthOf, parseKey } from "./calendar-utils";

// Month view — a 6×7 day matrix (Sunday-start) of the anchor's month. Each
// cell lists its day's session chips (colored by service); "+n more" when a
// day overflows. Click a chip → detail; click a day → drill into that day.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3; // chips shown per day before collapsing to "+n more"

export function MonthGrid({
  anchor,
  events,
  onChipClick,
  onDayClick,
}: {
  anchor: string;
  events: CalEvent[];
  onChipClick: (id: string) => void;
  onDayClick: (date: string) => void;
}) {
  const cells = monthMatrix(anchor);
  const activeMonth = monthOf(anchor);
  const todayKey = dateKey(new Date());

  const byDay = new Map<string, CalEvent[]>();
  for (const ev of events) {
    const bucket = byDay.get(ev.date);
    if (bucket) bucket.push(ev);
    else byDay.set(ev.date, [ev]);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.startMin - b.startMin);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Weekday header */}
      <div className="flex border-b border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="flex-1 py-2 text-center text-[13px] font-medium text-text-muted">
            {d}
          </div>
        ))}
      </div>

      {/* 6 week rows, each stretches to fill the height */}
      <div className="grid min-h-0 flex-1 grid-rows-6">
        {Array.from({ length: 6 }).map((_, week) => (
          <div key={week} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {cells.slice(week * 7, week * 7 + 7).map((day) => {
              const d = parseKey(day);
              const inMonth = d.getMonth() === activeMonth;
              const isToday = day === todayKey;
              const dayEvents = byDay.get(day) ?? [];
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onDayClick(day)}
                  className={`flex min-h-0 min-w-0 flex-col gap-0.5 border-l border-border p-1 text-left first:border-l-0 transition-colors hover:bg-canvas ${
                    inMonth ? "" : "bg-canvas/40"
                  }`}
                >
                  <span
                    className={`mx-0.5 mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full text-[13px] font-semibold ${
                      isToday
                        ? "bg-primary text-white"
                        : inMonth
                          ? "text-text"
                          : "text-text-muted"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <span className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                    {dayEvents.slice(0, MAX_CHIPS).map((ev) => (
                      <span
                        key={ev.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onChipClick(ev.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            e.preventDefault();
                            onChipClick(ev.id);
                          }
                        }}
                        className="flex items-center gap-1 truncate rounded-[4px] px-1 py-0.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                        style={{ background: ev.color, opacity: ev.muted ? 0.55 : 1 }}
                        title={`${ev.title} · ${ev.timeLabel}`}
                      >
                        {ev.icon && <Icon name={ev.icon} size={11} className="shrink-0" />}
                        <span className="truncate">{ev.title}</span>
                      </span>
                    ))}
                    {dayEvents.length > MAX_CHIPS && (
                      <span className="px-1 text-[11px] font-medium text-text-muted">
                        +{dayEvents.length - MAX_CHIPS} more
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

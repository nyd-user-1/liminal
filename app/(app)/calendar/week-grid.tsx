"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Icon } from "@/components/ui/icons";
import {
  DAY_END_MIN,
  DAY_START_MIN,
  PX_PER_MIN,
  clampMin,
  dateKey,
  parseKey,
  snap,
  toHHMM,
} from "./calendar-utils";

// Catalog `Calendar` — day-header row (today = teal tint) + hour gutter +
// hairline grid + teal current-time rule. Hosts `EventChip`s colored by
// service. Interactions: click chip → detail; click/drag empty grid → create;
// HTML5-drag a chip to another slot/day → move.

export interface CalEvent {
  id: string;
  date: string; // dateKey
  startMin: number;
  endMin: number;
  title: string;
  timeLabel: string;
  color: string;
  telehealth: boolean;
  muted: boolean; // completed / no_show — render dimmed
}

const GRID_H = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN;
const top = (min: number) => (min - DAY_START_MIN) * PX_PER_MIN;

/** Greedy lane layout so overlapping chips sit side by side. */
function layoutDay(events: CalEvent[]): Array<{ ev: CalEvent; lane: number; lanes: number }> {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: Array<{ ev: CalEvent; lane: number; lanes: number }> = [];
  let cluster: Array<{ ev: CalEvent; lane: number }> = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const c of cluster) out.push({ ...c, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };

  for (const ev of sorted) {
    if (ev.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= ev.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(ev.endMin);
    } else {
      laneEnds[lane] = ev.endMin;
    }
    cluster.push({ ev, lane });
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  }
  flush();
  return out;
}

export function WeekGrid({
  days,
  events,
  onChipClick,
  onSlotClick,
  onDragCreate,
  onMove,
}: {
  days: string[];
  events: CalEvent[];
  onChipClick: (id: string) => void;
  onSlotClick: (date: string, startMin: number) => void;
  onDragCreate: (date: string, startMin: number, endMin: number) => void;
  onMove: (id: string, date: string, startMin: number) => void;
}) {
  const [nowTick, setNowTick] = useState(() => new Date());
  const [sel, setSel] = useState<{ date: string; a: number; b: number } | null>(null);
  const [dropHint, setDropHint] = useState<{ date: string; min: number } | null>(null);
  const dragSel = useRef<{ date: string; start: number; rectTop: number; moved: boolean } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const todayKey = dateKey(nowTick);
  const nowMin = nowTick.getHours() * 60 + nowTick.getMinutes();
  const tzOffset = -nowTick.getTimezoneOffset() / 60;
  const tzLabel = `GMT${tzOffset >= 0 ? "+" : ""}${tzOffset}`;

  const hours: number[] = [];
  for (let m = DAY_START_MIN; m < DAY_END_MIN; m += 60) hours.push(m);

  const minFromY = (clientY: number, rectTop: number) =>
    clampMin(snap(DAY_START_MIN + (clientY - rectTop) / PX_PER_MIN));

  // ── drag-on-empty-grid to create (mouse events) ─────────────────────────────
  const startSelect = (e: ReactMouseEvent<HTMLDivElement>, date: string) => {
    if (e.button !== 0) return;
    const rectTop = e.currentTarget.getBoundingClientRect().top;
    const start = clampMin(Math.floor((DAY_START_MIN + (e.clientY - rectTop) / PX_PER_MIN) / 15) * 15);
    dragSel.current = { date, start, rectTop, moved: false };
    setSel({ date, a: start, b: start + 15 });

    const onMouseMove = (ev: MouseEvent) => {
      const d = dragSel.current;
      if (!d) return;
      const m = minFromY(ev.clientY, d.rectTop);
      if (Math.abs(m - d.start) >= 15) d.moved = true;
      setSel({ date: d.date, a: Math.min(d.start, m), b: Math.max(d.start + 15, m) });
    };
    const onMouseUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      const d = dragSel.current;
      dragSel.current = null;
      setSel(null);
      if (!d) return;
      if (!d.moved) {
        onSlotClick(d.date, d.start);
      } else {
        const m = minFromY(ev.clientY, d.rectTop);
        onDragCreate(d.date, Math.min(d.start, m), Math.max(d.start + 15, m));
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Day headers */}
      <div className="flex border-b border-border pr-2">
        <div className="flex w-14 shrink-0 items-end justify-center pb-1.5 text-[11px] text-text-muted">
          {tzLabel}
        </div>
        {days.map((day) => {
          const d = parseKey(day);
          const isToday = day === todayKey;
          return (
            <div key={day} className="flex flex-1 items-center justify-center gap-1.5 border-l border-border py-2">
              <span className={`text-[13px] font-medium ${isToday ? "text-primary" : "text-text-muted"}`}>
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-semibold ${
                  isToday ? "bg-primary text-white" : "text-text"
                }`}
              >
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable hour grid */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex pr-2" style={{ height: GRID_H }}>
          {/* Hour gutter */}
          <div className="relative w-14 shrink-0">
            {hours.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-text-muted"
                style={{ top: top(m) }}
              >
                {m === DAY_START_MIN
                  ? ""
                  : new Date(0, 0, 0, m / 60).toLocaleTimeString("en-US", { hour: "numeric" })}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const laid = layoutDay(events.filter((e) => e.date === day));
            const isToday = day === todayKey;
            return (
              <div
                key={day}
                className="relative flex-1 cursor-pointer border-l border-border"
                onMouseDown={(e) => startSelect(e, day)}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes("text/appointment")) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rectTop = e.currentTarget.getBoundingClientRect().top;
                  setDropHint({ date: day, min: minFromY(e.clientY, rectTop) });
                }}
                onDragLeave={() => setDropHint((h) => (h?.date === day ? null : h))}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/appointment");
                  if (!id) return;
                  e.preventDefault();
                  const rectTop = e.currentTarget.getBoundingClientRect().top;
                  setDropHint(null);
                  onMove(id, day, minFromY(e.clientY, rectTop));
                }}
              >
                {/* hairline hour rules */}
                {hours.slice(1).map((m) => (
                  <div key={m} className="absolute inset-x-0 border-t border-border" style={{ top: top(m) }} />
                ))}

                {/* drag-create ghost */}
                {sel?.date === day && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-10 rounded-[6px] border border-primary bg-teal-100/80"
                    style={{ top: top(sel.a), height: (sel.b - sel.a) * PX_PER_MIN }}
                  >
                    <span className="px-1.5 text-[11px] font-medium text-primary">
                      {toHHMM(sel.a)} – {toHHMM(sel.b)}
                    </span>
                  </div>
                )}

                {/* drop hint while dragging a chip */}
                {dropHint?.date === day && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-primary"
                    style={{ top: top(dropHint.min) }}
                  />
                )}

                {/* current-time teal rule */}
                {isToday && nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: top(nowMin) }}>
                    <div className="relative border-t-2 border-primary">
                      <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-primary" />
                    </div>
                  </div>
                )}

                {/* event chips */}
                {laid.map(({ ev, lane, lanes }) => {
                  const h = Math.max((ev.endMin - ev.startMin) * PX_PER_MIN, 15);
                  const wPct = 100 / lanes;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      draggable
                      onMouseDown={(e) => e.stopPropagation()}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/appointment", ev.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => onChipClick(ev.id)}
                      className="absolute z-10 overflow-hidden rounded-[6px] px-1.5 py-0.5 text-left text-white shadow-card transition-opacity hover:opacity-90"
                      style={{
                        top: top(ev.startMin),
                        height: h,
                        left: `calc(${lane * wPct}% + 3px)`,
                        width: `calc(${wPct}% - 6px)`,
                        background: ev.color,
                        opacity: ev.muted ? 0.55 : 1,
                      }}
                      title={`${ev.title} · ${ev.timeLabel}`}
                    >
                      <span className="flex items-center gap-1 text-[12px] font-semibold leading-tight">
                        {ev.telehealth && <Icon name="video" size={12} className="shrink-0" />}
                        <span className="truncate">{ev.title}</span>
                      </span>
                      {h >= 34 && <span className="block truncate text-[11px] font-medium opacity-90">{ev.timeLabel}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

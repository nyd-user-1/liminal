"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { EcoSection } from "./section";

// The fuel gauge — three completion cards reading how much of the fleet's
// budget is spent. Cards 1 and 2 are LIVE: Claude Code's own five-hour and
// seven-day rate-limit percentages, straight off its statusline snapshot.
// Card 3 is MODELED — Fable's share of the week's work, metered from the local
// transcripts by hq's method — and it wears a `modeled` label so an estimate is
// never read as a measurement.
//
// The reading itself is server-side (lib/workspace-usage.ts, behind
// /api/workspace/usage): ~/.claude is never touched from a browser, and the
// cold transcript walk never blocks the page render.
//
// The payload types are mirrored here rather than imported from
// lib/workspace-usage: hq hit a Turbopack bug where even a bare `import type`
// from a module that imports node:fs pulled fs into the client bundle
// (see ~/Code/hq/app/ui/usage-panel.tsx:8). The route's JSON is the contract;
// these track it.

type GaugeState = "healthy" | "warning" | "depleted" | "share";
interface GaugeCard {
  key: "session" | "week" | "fable";
  label: string;
  pct: number | null;
  state: GaugeState;
  source: "live" | "modeled";
  primary: string;
  secondary: string;
}
interface GaugeData {
  cards: GaugeCard[];
  generatedAt: number;
}

// 25 × 4 — one square per whole percent, so the grid stays the reading rather
// than a decoration, in the reference's wider-and-shorter proportion.
const SQUARES = 100;
const COLUMNS = 25;

// Filled-square colour by state, on theme tokens. `share` is a mix, not a fuel
// level, so it stays teal — ramping it to red would say "nearly out" about a
// number that has no cap.
const FILL: Record<GaugeState, string> = {
  healthy: "bg-success",
  warning: "bg-warning",
  depleted: "bg-danger",
  share: "bg-primary",
};

const SOURCE_NOTE: Record<GaugeCard["source"], string> = {
  live: "Live — Claude Code's own rate-limit window, read from its statusline snapshot.",
  modeled:
    "Modeled, not measured — metered from local transcripts and weighted by token shape and model tier. The tier multiplier is a calibration knob, so treat this as an estimate.",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 0 → `to` on mount (easeOutQuart), held at `to` under reduced motion. Drives
 *  the percentage and the square fill from one value so they can't disagree. */
function useCountUp(to: number | null): number {
  const [value, setValue] = useState(to ?? 0);
  const raf = useRef(0);
  useEffect(() => {
    if (to === null) return;
    if (prefersReducedMotion()) {
      setValue(to);
      return;
    }
    const t0 = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setValue(p < 1 ? to * (1 - Math.pow(1 - p, 4)) : to);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to]);
  return value;
}

function GaugeTile({ card }: { card: GaugeCard }) {
  const eased = useCountUp(card.pct);
  const filled = card.pct === null ? 0 : Math.round((eased / 100) * SQUARES);

  return (
    <Card className="flex h-full min-w-0 flex-col gap-4 p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {/* The Claude mark, one identity for all three cards — every reading
              here is Claude's consumption. A 250px source at 18px stays sharp
              well past 3x DPR, so the raster needs no vector twin. */}
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-field bg-canvas">
            <img src="/brand/claude-mark.webp" alt="" width={18} height={18} />
          </span>
          <span className="truncate text-sm font-medium text-text">{card.label}</span>
          {/* The chip describes the READING, so it goes away when there isn't
              one — a green "live" over an em-dash would claim a measurement the
              card is explicitly saying it doesn't have. */}
          {card.pct !== null && (
            <Tooltip label={SOURCE_NOTE[card.source]}>
              <span
                className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${
                  card.source === "live" ? "text-success" : "text-text-muted"
                }`}
              >
                · {card.source}
              </span>
            </Tooltip>
          )}
        </span>
        <span className="shrink-0 text-[22px] font-bold leading-none tabular-nums text-text">
          {card.pct === null ? "—" : `${Math.round(eased)}%`}
        </span>
      </div>

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {Array.from({ length: SQUARES }, (_, i) => (
          <span
            key={i}
            className={`aspect-square rounded-[3px] ${i < filled ? FILL[card.state] : "bg-canvas"}`}
          />
        ))}
      </div>

      {/* Wraps rather than truncates: at a narrow card the reset clock drops to
          its own line instead of eating the reading it sits next to. */}
      <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13px] text-text-muted">
        <span>{card.primary}</span>
        <span>{card.secondary}</span>
      </div>
    </Card>
  );
}

/** The three cards' resting frame, shown while the first reading is in flight —
 *  the row never pops into existence, it fills in. */
const PENDING: GaugeCard[] = (["session", "week", "fable"] as const).map((key) => ({
  key,
  label: key === "session" ? "Window usage" : key === "week" ? "Weekly usage" : "Fable usage",
  pct: null,
  state: "healthy" as GaugeState,
  source: key === "fable" ? ("modeled" as const) : ("live" as const),
  primary: "reading…",
  secondary: key === "session" ? "5-hour window" : "7-day window",
}));

export function UsageGauge() {
  const [cards, setCards] = useState<GaugeCard[]>(PENDING);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/workspace/usage", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<GaugeData>) : null))
        .then((d) => {
          if (alive && d) setCards(d.cards);
        })
        .catch(() => {
          /* the resting frame stands */
        });
    load();
    // The five-hour window moves while the founder sits on this page; a minute
    // is fine granularity for a percentage that ticks in whole points.
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <EcoSection
      title="Fuel"
      info="How much of the fleet's budget is spent. The five-hour and seven-day figures are Claude Code's own rate-limit windows, read live. The Fable share is modeled from local transcripts — an estimate, labelled as one."
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <GaugeTile key={c.key} card={c} />
        ))}
      </div>
    </EcoSection>
  );
}

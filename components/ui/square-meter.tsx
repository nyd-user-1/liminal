"use client";

import { useEffect, useRef, useState } from "react";

// The grid-of-squares meter — a block of small rounded squares filling to show
// a proportion. One square per whole percent, so the grid IS the reading rather
// than a decoration.
//
// NEW PRIMITIVE, added deliberately (TASK-MONITOR Part 3). The motif was built
// first inside app/(app)/workspace/usage-gauge.tsx and is now wanted on
// /monitor too. Nothing in the kit composes to it: ProgressBar is a single
// linear bar, and a hundred-cell quantised grid is not that shape. Rather than
// duplicate the implementation into a second page — the thing the house rule
// exists to prevent — the motif moves here where both surfaces can share it.
//
// FOLLOW-UP for whoever owns app/(app)/workspace/: usage-gauge.tsx still has
// its own copy of this grid and should be refactored onto this primitive so
// there is exactly one. That file is outside this tranche's seam, so it was
// deliberately left untouched rather than edited across a seam boundary.

export type MeterState = "healthy" | "warning" | "depleted" | "share";

// Filled-square colour by state, on theme tokens. `share` is a mix rather than
// a fuel level, so it stays teal — ramping it to red would say "nearly out"
// about a number that has no cap.
const FILL: Record<MeterState, string> = {
  healthy: "bg-success",
  warning: "bg-warning",
  depleted: "bg-danger",
  share: "bg-primary",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 0 → `to` on mount (easeOutQuart), held at `to` under reduced motion. Exported
 *  so a consumer can drive its own percentage label from the SAME value that
 *  fills the squares, and the two can never disagree mid-animation. */
export function useCountUp(to: number | null, durationMs = 900): number {
  const [value, setValue] = useState(to ?? 0);
  const raf = useRef(0);
  useEffect(() => {
    if (to === null) return;
    if (prefersReducedMotion()) {
      setValue(to);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      setValue(p < 1 ? to * (1 - Math.pow(1 - p, 4)) : to);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, durationMs]);
  return value;
}

/**
 * `value` is a percentage 0–100, or null for "no reading" — which renders the
 * empty grid rather than a misleading zero-fill.
 *
 * `columns` defaults to 25, giving the 25 × 4 proportion the founder asked for.
 */
export function SquareMeter({
  value,
  state = "healthy",
  columns = 25,
  squares = 100,
  className = "",
}: {
  value: number | null;
  state?: MeterState;
  columns?: number;
  squares?: number;
  className?: string;
}) {
  const eased = useCountUp(value);
  const filled = value === null ? 0 : Math.round((eased / 100) * squares);

  return (
    <div
      className={`grid gap-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {Array.from({ length: squares }, (_, i) => (
        <span key={i} className={`aspect-square rounded-[3px] ${i < filled ? FILL[state] : "bg-canvas"}`} />
      ))}
    </div>
  );
}

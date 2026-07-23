"use client";

import { useRef, useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";

// ThinkingOrb — the Leuk orb (official name), the amber watercolor mark that
// fronts the chat assistant. While the assistant is generating (`isThinking`)
// it breathes: a slow scale/opacity pulse (.orb-pulse in globals.css — 2.4s
// cycle, no rotation, disabled under prefers-reduced-motion). At rest it sits
// static at full opacity. Interactive form (tooltip + onActivate): hovering
// greets ("Hi, I'm Leuk…" — small italic, Claude-style), clicking replays two
// quick breaths (.orb-poke) and hands focus to the chat input via onActivate.

interface Props {
  /** Rendered box in px. */
  size?: number;
  /** Animate while true; static at rest when false. */
  isThinking?: boolean;
  /** Hover greeting (small italic navy bubble). */
  tooltip?: string;
  /** Click handler — the /chat page uses it to focus the input. */
  onActivate?: () => void;
  className?: string;
}

export function ThinkingOrb({ size = 32, isThinking = false, tooltip, onActivate, className = "" }: Props) {
  const [poked, setPoked] = useState(false);
  const pokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = () => {
    setPoked(true);
    if (pokeTimer.current) clearTimeout(pokeTimer.current);
    pokeTimer.current = setTimeout(() => setPoked(false), 1900);
    onActivate?.();
  };

  const art = (
    <picture className={isThinking ? "orb-pulse" : poked ? "orb-poke" : undefined}>
      <source srcSet="/leuk-logo-full.avif" type="image/avif" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/leuk-logo-full.png"
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="h-full w-full object-contain"
        style={{ width: size, height: size }}
      />
    </picture>
  );

  const core = onActivate ? (
    <button
      type="button"
      onClick={poke}
      aria-label="Leuk"
      className={`inline-flex cursor-pointer select-none items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {art}
    </button>
  ) : (
    <span
      className={`inline-flex select-none items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {art}
    </span>
  );

  if (!tooltip) return core;
  return (
    <Tooltip label={tooltip} placement="right" labelClassName="text-[12px] italic">
      {core}
    </Tooltip>
  );
}

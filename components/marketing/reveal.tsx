"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Marketing-only scroll choreography. Each painting/section "develops in" once
// as it enters the viewport — the same fade+settle vocabulary as the hero's
// `.mkt-develop`, but triggered on scroll instead of load. Deliberately quiet:
// one moment, no loop, no parallax.
//
// SSR-safe and progressive: the server renders the content fully visible. On the
// client we only ARM the hidden state after mount, and only when the viewer
// hasn't asked for reduced motion — so no-JS and reduced-motion visitors always
// see the content, never a blank frame. Targets sit below the fold, so the
// arm-then-reveal happens off-screen with no visible flash.

type RevealState = "idle" | "armed" | "in";

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RevealState>("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // stay visible
    setState("armed");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const motion =
    state === "armed"
      ? "opacity-0 translate-y-4"
      : state === "in"
        ? "opacity-100 translate-y-0 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        : ""; // idle → fully visible (SSR / no-JS / reduced-motion)
  // NB: no scale transform — scaling a full-width wrapper up pushes its edges
  // past the viewport and shows a horizontal scrollbar until it reveals.

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`${className} ${motion}`.trim()}
    >
      {children}
    </div>
  );
}

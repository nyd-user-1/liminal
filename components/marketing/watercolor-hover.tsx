"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

// Wraps an illustration so a soft pigment bloom follows the cursor and sinks into
// the paper via multiply (styling lives in .watercolor-hover in globals.css).
// One wrapper per illustration; each tracks its own cursor position through the
// --mx/--my custom properties. Adapts the "one JS listener" idea to React so it
// survives re-renders without a global querySelectorAll pass.
export function WatercolorHover({ className = "", children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div ref={ref} onMouseMove={onMove} className={`watercolor-hover ${className}`.trim()}>
      {children}
    </div>
  );
}

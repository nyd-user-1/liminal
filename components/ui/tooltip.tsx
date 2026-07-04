"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Catalog `Tooltip` — dark navy rounded bubble, white 13px label, on hover.
// Portaled to <body> so it escapes scroll/stacking contexts; measured after
// mount, anchored to `placement`, then clamped into the viewport.
// (Positioning pattern adapted from hq's tooltip.tsx.)

type Placement = "top" | "bottom" | "right";

const GUTTER = 8;

export function Tooltip({
  label,
  placement = "top",
  className,
  children,
}: {
  label: string;
  placement?: Placement;
  className?: string;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!anchor || !chipRef.current) return;
    const c = chipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top: number;
    if (placement === "right") {
      left = anchor.right + GUTTER;
      top = anchor.top + anchor.height / 2 - c.height / 2;
    } else {
      left = anchor.left + anchor.width / 2 - c.width / 2;
      const above = anchor.top - GUTTER - c.height;
      const below = anchor.bottom + GUTTER;
      if (placement === "top") top = above >= GUTTER ? above : below;
      else top = below + c.height <= vh - GUTTER ? below : above;
    }
    left = Math.max(GUTTER, Math.min(left, vw - c.width - GUTTER));
    top = Math.max(GUTTER, Math.min(top, vh - c.height - GUTTER));
    setPos({ left, top });
  }, [anchor, placement]);

  const hide = () => {
    setAnchor(null);
    setPos(null);
  };

  return (
    <span
      ref={wrapRef}
      onMouseEnter={() => setAnchor(wrapRef.current?.getBoundingClientRect() ?? null)}
      onMouseLeave={hide}
      className={`inline-flex shrink-0${className ? ` ${className}` : ""}`}
    >
      {children}
      {anchor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={chipRef}
            role="tooltip"
            style={{
              left: pos?.left ?? 0,
              top: pos?.top ?? 0,
              visibility: pos ? "visible" : "hidden",
            }}
            className="pointer-events-none fixed z-100 whitespace-nowrap rounded-field bg-navy-900 px-2.5 py-1.5 text-[13px] text-white shadow-menu"
          >
            {label}
          </div>,
          document.body,
        )}
    </span>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { TextLink } from "@/components/ui/text-link";

// Reusable clamp + "Show more" — NEW primitive (nothing in components/ui/*
// covers multi-line text truncation). Renders `text` verbatim (newlines as
// paragraph breaks via `whitespace-pre-line`), hard-cut to `lines` (no
// ellipsis — a fixed-height overflow clip, not -webkit-line-clamp, which
// would append "…") until the reader asks to expand. The toggle only renders
// if the text actually overflows the clamp at the current width, and reuses
// the catalog `TextLink` (teal, underline wipes in on hover).

const LINE_HEIGHT_PX = 15 * 1.625; // text-[15px] leading-relaxed

export function ClampText({
  text,
  lines = 4,
  className = "",
  onToggle,
}: {
  text: string;
  lines?: 3 | 4;
  className?: string;
  /** Fires with the new expanded state whenever the reader toggles — lets a parent reveal more content alongside. */
  onToggle?: (expanded: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text, lines]);

  if (!text) return null;

  return (
    <div className={className}>
      <div
        ref={ref}
        style={expanded ? undefined : { maxHeight: `${lines * LINE_HEIGHT_PX}px` }}
        className="whitespace-pre-line overflow-hidden text-[15px] leading-relaxed text-text-body"
      >
        {text}
      </div>
      {(overflows || expanded) && (
        <TextLink
          onClick={() =>
            setExpanded((e) => {
              const next = !e;
              onToggle?.(next);
              return next;
            })
          }
          className="mt-2"
        >
          {expanded ? "Show less" : "Show more"}
        </TextLink>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";

// The hover Copy chip as a real button — the CopyCard chip, lifted out so a card
// whose body click does something else (open the schema tree) can still offer
// copy without the two gestures fighting. Stops propagation so a copy never also
// triggers the card. Drops to the bottom corner when a badge holds the top-right.
export function CopyChip({ text, pos = "top" }: { text: string; pos?: "top" | "bottom" }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          return;
        }
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1400);
      }}
      className={`absolute right-3 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity ${
        pos === "top" ? "top-3" : "bottom-3"
      } ${copied ? "bg-success-tint text-success opacity-100" : "bg-canvas text-text-muted opacity-0 group-hover:opacity-100"}`}
    >
      <Icon name={copied ? "check" : "copy"} size={11} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

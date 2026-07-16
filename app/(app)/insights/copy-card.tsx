"use client";

import { useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";

// Click-to-copy wrapper for Insights cards. The whole card is the target: one
// click puts a terminal-paste-ready line on the clipboard ("payer_sources —
// 12. The insurers whose directories we pull… · LIVE 6 of 12 · powers
// /directory"). Links and buttons inside the card keep working — a click that
// starts on one is theirs, not ours.

export function CopyCard({
  text,
  children,
  className = "",
  chip = "top",
}: {
  text: string;
  children: ReactNode;
  className?: string;
  /** Where the Copy/Copied chip floats — "bottom" for cards whose top-right corner is occupied (badges, toggles). */
  chip?: "top" | "bottom";
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("a,button,[role='switch']")) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; // clipboard unavailable (permissions/http) — do nothing loudly
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div
      onClick={onClick}
      title="Click to copy"
      className={`group relative min-w-0 cursor-copy ${className}`}
    >
      {children}
      <span
        aria-live="polite"
        className={`pointer-events-none absolute right-3 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity ${chip === "top" ? "top-3" : "bottom-3"} ${
          copied ? "bg-success-tint text-success opacity-100" : "bg-canvas text-text-muted opacity-0 group-hover:opacity-100"
        }`}
      >
        <Icon name={copied ? "check" : "copy"} size={11} />
        {copied ? "Copied" : "Copy"}
      </span>
    </div>
  );
}

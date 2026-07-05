"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";

// Catalog `CallHeader` (§3b·67) — top strip on the dark stage: camera chip +
// call title + elapsed timer · "Only visible to you" · people count; right:
// Recording Badge (while the scribe is capturing) + page-supplied actions.

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function CallHeader({
  title,
  startedAt,
  participants,
  visibilityNote = "Only visible to you",
  recording = false,
  right,
}: {
  title: string;
  startedAt: number | null; // epoch ms when the call connected; null = not started
  participants: number;
  visibilityNote?: string | null;
  recording?: boolean;
  right?: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 py-3 sm:px-6">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-white/10 text-white">
        <Icon name="video" />
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h1 className="truncate text-[15px] font-semibold text-white">{title}</h1>
          {startedAt && (
            <span className="text-[13px] tabular-nums text-white/70">{formatElapsed(now - startedAt)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[13px] text-white/50">
          {visibilityNote && <span>{visibilityNote}</span>}
          {visibilityNote && <span aria-hidden>·</span>}
          <span className="inline-flex items-center gap-1">
            <Icon name="users" size={14} />
            {participants}
          </span>
        </div>
      </div>
      <div className="pointer-events-auto ml-auto flex items-center gap-2">
        {recording && (
          <Badge variant="solid-danger">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
            Recording
          </Badge>
        )}
        {right}
      </div>
    </header>
  );
}

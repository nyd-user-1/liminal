"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/text-link";
import { Toggle } from "@/components/ui/toggle";
import { formatDateTime } from "@/lib/format";
import type { BriefingResult } from "@/lib/briefing";
import { CopyCard } from "./copy-card";

// Layer 3 — the Platform briefing, behind a switch that is OFF by default.
// Nothing here calls the model on its own: flipping the switch ON generates a
// fresh briefing (POST); page loads only ever ask for what's already cached
// (GET, which never touches the API). The preference persists per browser.

const STORAGE_KEY = "insights-ai-briefing";

type View =
  | { kind: "off" }
  | { kind: "loading" }
  | { kind: "empty" } // switch on, nothing cached yet, waiting on the user
  | { kind: "ready"; text: string; generatedAt: string }
  | { kind: "error"; reason: string };

export function BriefingCard() {
  const [enabled, setEnabled] = useState(false);
  const [view, setView] = useState<View>({ kind: "off" });
  const mounted = useRef(false);

  // Restore the switch; with it on, show whatever the server already has —
  // a GET is cache-only, so this costs nothing.
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (typeof localStorage === "undefined" || localStorage.getItem(STORAGE_KEY) !== "1") return;
    setEnabled(true);
    setView({ kind: "loading" });
    fetch("/api/insights/briefing")
      .then((r) => r.json() as Promise<BriefingResult>)
      .then((b) => setView(b.state === "ok" ? { kind: "ready", text: b.text, generatedAt: b.generatedAt } : { kind: "empty" }))
      .catch(() => setView({ kind: "empty" }));
  }, []);

  async function generate() {
    setView({ kind: "loading" });
    try {
      const b = (await (await fetch("/api/insights/briefing", { method: "POST" })).json()) as BriefingResult;
      setView(b.state === "ok" ? { kind: "ready", text: b.text, generatedAt: b.generatedAt } : { kind: "error", reason: b.reason });
    } catch {
      setView({ kind: "error", reason: "Could not reach the server." });
    }
  }

  function onToggle(next: boolean) {
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    if (next) void generate();
    else setView({ kind: "off" });
  }

  const body =
    view.kind === "off" ? (
      <p className="text-sm text-text-muted">
        Off. Flip the switch and Claude reads the inventory below — table counts and sync dates only, never patient data — and writes
        ~150 words on what we have, what grew, and what&apos;s thin.
      </p>
    ) : view.kind === "loading" ? (
      <div className="flex flex-col gap-2" aria-hidden>
        <span className="h-3.5 w-full animate-pulse rounded bg-canvas" />
        <span className="h-3.5 w-11/12 animate-pulse rounded bg-canvas" />
        <span className="h-3.5 w-4/5 animate-pulse rounded bg-canvas" />
      </div>
    ) : view.kind === "empty" ? (
      <p className="text-sm text-text-muted">
        Nothing generated yet.{" "}
        <TextLink onClick={() => void generate()} className="text-sm">
          Generate a briefing
        </TextLink>
        .
      </p>
    ) : view.kind === "error" ? (
      <p className="text-sm text-text-muted">{view.reason}</p>
    ) : (
      <>
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-text">{view.text}</p>
        <p className="text-[13px] text-text-muted">
          Written from the counts below — no patient data is sent. {formatDateTime(view.generatedAt)} ·{" "}
          <TextLink onClick={() => void generate()} className="text-[13px]">
            Regenerate
          </TextLink>
        </p>
      </>
    );

  const card = (
    <Card className="flex flex-col gap-2.5 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-text">
          <Icon name="wand-sparkles" size={16} className="text-primary" />
          Platform briefing
        </span>
        <span className="flex items-center gap-2.5">
          {view.kind === "ready" && <Badge variant="info">Claude</Badge>}
          <Toggle checked={enabled} onChange={onToggle} />
        </span>
      </div>
      {body}
    </Card>
  );

  // Only a real briefing is worth copying.
  return view.kind === "ready" ? (
    <CopyCard chip="bottom" text={`Platform briefing (${formatDateTime(view.generatedAt)}):\n${view.text}`}>
      {card}
    </CopyCard>
  ) : (
    card
  );
}

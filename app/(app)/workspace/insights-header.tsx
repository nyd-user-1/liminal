"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/text-link";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip } from "@/components/ui/tooltip";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { formatDateTime } from "@/lib/format";
import type { BriefingResult } from "@/lib/briefing";
import { CopyCard } from "./copy-card";

// The workspace masthead. Left side is the greeting — until the switch is
// thrown, at which point Claude's read of the inventory takes the greeting's
// place as a headline + short article (the sports /game "highlights" pattern:
// on-demand AI copy where static copy sat). The switch itself (wand icon +
// Toggle) is portaled into the TopBar strip, left of the bell — no label.
//
// The model is only ever called from the switch (POST). Page loads with the
// switch already on ask only for what's cached (GET — never generates).

const STORAGE_KEY = "insights-ai-briefing";

type View =
  | { kind: "greeting" }
  | { kind: "loading" }
  | { kind: "ready"; headline: string | null; body: string; generatedAt: string }
  | { kind: "error"; reason: string };

/** First line is the headline (the prompt asks for it); everything after is
 *  the article. Older cached briefings without one degrade to article-only. */
function parseBriefing(text: string): { headline: string | null; body: string } {
  const idx = text.indexOf("\n");
  if (idx === -1 || idx > 90) return { headline: null, body: text };
  return { headline: text.slice(0, idx).trim(), body: text.slice(idx + 1).trim() };
}

export function InsightsHeader({ greeting, canBrief }: { greeting: string; canBrief: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [view, setView] = useState<View>({ kind: "greeting" });
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current || !canBrief) return;
    mounted.current = true;
    if (typeof localStorage === "undefined" || localStorage.getItem(STORAGE_KEY) !== "1") return;
    setEnabled(true);
    setView({ kind: "loading" });
    fetch("/api/insights/briefing")
      .then((r) => r.json() as Promise<BriefingResult>)
      .then((b) =>
        setView(b.state === "ok" ? { kind: "ready", ...parseBriefing(b.text), generatedAt: b.generatedAt } : { kind: "greeting" }),
      )
      .catch(() => setView({ kind: "greeting" }));
  }, [canBrief]);

  async function generate() {
    setView({ kind: "loading" });
    try {
      const b = (await (await fetch("/api/insights/briefing", { method: "POST" })).json()) as BriefingResult;
      setView(b.state === "ok" ? { kind: "ready", ...parseBriefing(b.text), generatedAt: b.generatedAt } : { kind: "error", reason: b.reason });
    } catch {
      setView({ kind: "error", reason: "Could not reach the server." });
    }
  }

  function onToggle(next: boolean) {
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    if (next) void generate();
    else setView({ kind: "greeting" });
  }

  const left =
    view.kind === "loading" ? (
      <div className="flex animate-pulse flex-col gap-2.5" aria-hidden>
        <span className="h-6 w-3/5 rounded bg-canvas" />
        <span className="mt-1 h-3.5 w-full rounded bg-canvas" />
        <span className="h-3.5 w-[92%] rounded bg-canvas" />
        <span className="h-3.5 w-[70%] rounded bg-canvas" />
      </div>
    ) : view.kind === "ready" ? (
      <CopyCard chip="bottom" text={`${view.headline ? view.headline + "\n" : ""}${view.body}`}>
        <div className="flex flex-col gap-1.5">
          {view.headline && <h2 className="text-xl font-semibold leading-snug text-text">{view.headline}</h2>}
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-text-body">{view.body}</p>
          <p className="text-[13px] text-text-muted">
            {formatDateTime(view.generatedAt)} · counts and sync dates only, never patient data ·{" "}
            <TextLink onClick={() => void generate()} className="text-[13px]">
              Regenerate
            </TextLink>
          </p>
        </div>
      </CopyCard>
    ) : view.kind === "error" ? (
      <div className="flex flex-col gap-1">
        <p className="text-[15px] text-text-muted">{greeting}</p>
        <p className="text-[13px] text-text-muted">{view.reason}</p>
      </div>
    ) : (
      <p className="text-[15px] text-text-muted">{greeting}</p>
    );

  return (
    <div className="flex min-w-0 items-start gap-6">
      <div className="min-w-0 flex-1">{left}</div>
      {/* The control lives in the TopBar strip, immediately left of the bell —
          portaled there so it still shares this component's state and fetch. */}
      {canBrief && (
        <TopBarActions>
          <Tooltip label={enabled ? "Turn off the AI briefing" : "Generate an AI briefing"} placement="bottom">
            <span className="flex items-center gap-2">
              <Icon name="wand-sparkles" size={16} className="text-primary" />
              <Toggle checked={enabled} onChange={onToggle} />
            </span>
          </Tooltip>
        </TopBarActions>
      )}
    </div>
  );
}

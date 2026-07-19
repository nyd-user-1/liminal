"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/text-link";
import { formatDateTime } from "@/lib/format";
import type { BriefingResult } from "@/lib/briefing";
import { CopyCard } from "./copy-card";

// The Summary card IS the briefing surface. At rest it shows the orientation
// paragraph (placeholder copy). Press the wand in the card's top-right corner
// and Claude's read of the overnight inventory takes the paragraph's place —
// a headline + short article, in-card (the sports /game "highlights" pattern).
// Press it again and the placeholder returns. The switch is only ever a POST;
// a reload with the switch already on asks only for what's cached (GET).

const STORAGE_KEY = "insights-ai-briefing";

type View =
  | { kind: "placeholder" }
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

const PLACEHOLDER =
  "The founder's control room. Up top, live counts of the objects the platform is built on — providers, in-network rates, billing entities, plan filings — each opening to the tables behind it. Press the wand for an on-demand read of the overnight numbers; below sit the work queue, the agent fleet, and last night's sync health.";

export function SummaryCard({ canBrief }: { canBrief: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [view, setView] = useState<View>({ kind: "placeholder" });
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
        setView(b.state === "ok" ? { kind: "ready", ...parseBriefing(b.text), generatedAt: b.generatedAt } : { kind: "placeholder" }),
      )
      .catch(() => setView({ kind: "placeholder" }));
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

  function onToggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    if (next) void generate();
    else setView({ kind: "placeholder" });
  }

  const body =
    view.kind === "loading" ? (
      <div className="flex animate-pulse flex-col gap-2.5" aria-hidden>
        <span className="h-6 w-3/5 rounded bg-canvas" />
        <span className="mt-1 h-3.5 w-full rounded bg-canvas" />
        <span className="h-3.5 w-[92%] rounded bg-canvas" />
        <span className="h-3.5 w-[70%] rounded bg-canvas" />
      </div>
    ) : view.kind === "ready" ? (
      <CopyCard chip="bottom" text={`${view.headline ? view.headline + "\n" : ""}${view.body}`}>
        <div className="flex flex-col gap-1.5 pr-6">
          {view.headline && <h3 className="text-xl font-semibold leading-snug text-text">{view.headline}</h3>}
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
      <p className="text-sm text-text-muted">
        {view.reason}{" "}
        <TextLink onClick={() => void generate()} className="text-[13px]">
          Try again
        </TextLink>
      </p>
    ) : (
      <p className="max-w-3xl text-sm leading-relaxed text-text-muted">{PLACEHOLDER}</p>
    );

  return (
    <Card className="relative flex min-w-0 flex-col gap-1.5 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-text">Summary</h2>
        {canBrief && (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={enabled}
            title={enabled ? "Turn off the AI briefing" : "Generate an AI briefing"}
            className={`-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-field transition-colors hover:bg-canvas ${
              enabled ? "text-primary" : "text-text-muted"
            }`}
          >
            <Icon name="wand-sparkles" size={17} />
          </button>
        )}
      </div>
      {body}
    </Card>
  );
}

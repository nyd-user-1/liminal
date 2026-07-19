"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { ASOF, BACKLOG, type BacklogIssue, type Priority } from "@/lib/linear-backlog";
import { formatDate } from "@/lib/format";

// Layer 1, row two — the work queue. LEFT: the whole Linear board snapshot,
// scrolling itself as a gentle vertical marquee (pauses on hover, off under
// reduced-motion — see .wq-* in globals.css). RIGHT: three pin slots. Click a
// row to pin it (max three, persisted in localStorage); a fourth click drops
// the oldest pin and takes its place, so the newest three always show.

const PINS_KEY = "workspace-pins";
const MAX_PINS = 3;

const PRIORITY_VARIANT: Record<Priority, "danger" | "warning" | "info" | "neutral"> = {
  Urgent: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
  None: "neutral",
};

function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{priority}</Badge>;
}

function IssueRow({ issue, onPin }: { issue: BacklogIssue; onPin: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPin(issue.id)}
      title="Pin this item"
      className="flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left transition-colors hover:bg-canvas"
    >
      <span className="w-[74px] shrink-0 font-mono text-[11px] tracking-wide text-text-muted">{issue.id}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-text">{issue.title}</span>
      {issue.status === "In Progress" ? (
        <Badge variant="success">In progress</Badge>
      ) : (
        <PriorityBadge priority={issue.priority} />
      )}
    </button>
  );
}

export function WorkQueue() {
  const [pins, setPins] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PINS_KEY);
      if (raw) setPins((JSON.parse(raw) as string[]).filter((id) => BACKLOG.some((b) => b.id === id)).slice(0, MAX_PINS));
    } catch {
      /* ignore malformed state */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(PINS_KEY, JSON.stringify(pins));
  }, [pins, loaded]);

  const pin = (id: string) =>
    setPins((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      return next.length > MAX_PINS ? next.slice(next.length - MAX_PINS) : next; // drop the oldest
    });

  const unpin = (id: string) => setPins((prev) => prev.filter((p) => p !== id));

  const pinned = pins.map((id) => BACKLOG.find((b) => b.id === id)).filter((b): b is BacklogIssue => Boolean(b));
  const slots = Array.from({ length: MAX_PINS }, (_, i) => pinned[i] ?? null);

  // Speed scales with list length so the pace stays gentle regardless of count.
  const durationSec = Math.round(BACKLOG.length * 1.4);

  return (
    <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-3">
      {/* LEFT — the board, auto-scrolling */}
      <Card className="flex h-[420px] min-w-0 flex-col gap-2 p-5 lg:col-span-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-text">Work queue</h3>
          <span className="text-[12px] text-text-muted">Board snapshot · {formatDate(`${ASOF}T12:00:00`)}</span>
        </div>
        <div className="wq-viewport relative min-h-0 flex-1 overflow-hidden">
          <div className="wq-track flex flex-col" style={{ "--wq-dur": `${durationSec}s` } as React.CSSProperties}>
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1} className="flex flex-col">
                {BACKLOG.map((issue) => (
                  <IssueRow key={`${copy}-${issue.id}`} issue={issue} onPin={pin} />
                ))}
              </div>
            ))}
          </div>
          {/* soft fades top/bottom so rows enter and leave cleanly */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-surface to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface to-transparent" />
        </div>
      </Card>

      {/* RIGHT — three pin slots, total height matches the list */}
      <div className="flex min-w-0 flex-col gap-3">
        {slots.map((issue, i) =>
          issue ? (
            <Card key={issue.id} className="flex flex-1 min-w-0 flex-col justify-center gap-1.5 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] tracking-wide text-text-muted">{issue.id}</span>
                <div className="flex items-center gap-1.5">
                  <PriorityBadge priority={issue.priority} />
                  <button
                    type="button"
                    onClick={() => unpin(issue.id)}
                    aria-label={`Unpin ${issue.id}`}
                    className="text-text-muted transition-colors hover:text-text"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              </div>
              <p className="min-w-0 text-[13px] font-medium leading-snug text-text">{issue.title}</p>
            </Card>
          ) : (
            <Card
              key={`empty-${i}`}
              className="flex flex-1 items-center justify-center gap-2 border-dashed p-4 text-text-muted"
            >
              <Icon name="pin" size={14} />
              <span className="text-[13px]">Pin an item</span>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}

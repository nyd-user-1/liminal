"use client";

import { useEffect, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { BACKLOG, linearIssueUrl, type BacklogIssue, type Priority } from "@/lib/linear-backlog";
import { usePins } from "./use-pins";

// The work queue — the Linear board as a live-feeling ledger, the fourth tab of
// the Operations panel. Ten rows sit in view, then the list scrolls itself
// gently (paused on hover, held still under reduced-motion). Every id and title
// is an external link into Linear; a pin per row lifts up to three issues into
// the Pinned tickets card up top. The rows themselves aren't clickable — no
// pointer cursor promising a click that isn't there.

const PRIORITY_VARIANT: Record<Priority, "danger" | "warning" | "info" | "neutral"> = {
  Urgent: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
  None: "neutral",
};

// Sort weight so "Status" sorts In Progress → Urgent → … → None.
const STATUS_WEIGHT: Record<string, number> = { "In Progress": 0, Urgent: 1, High: 2, Medium: 3, Low: 4, None: 5 };

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const linkCls = "hover:text-primary hover:underline";

export function WorkQueue() {
  const { isPinned, toggle, full } = usePins();
  const wrapRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  const columns = useMemo<DataTableColumn<BacklogIssue>[]>(
    () => [
      {
        key: "id",
        label: "Issue",
        fixed: true,
        sortValue: (r) => Number(r.id.replace(/^NYS-/, "").match(/^\d+/)?.[0] ?? 0),
        render: (r) => (
          <a href={linearIssueUrl(r.id)} target="_blank" rel="noreferrer" className={`font-mono text-[12px] tracking-wide text-text-muted ${linkCls}`}>
            {r.id}
          </a>
        ),
      },
      {
        key: "title",
        label: "Title",
        cellClassName: "max-w-md truncate",
        sortValue: (r) => r.title,
        render: (r) => (
          <a href={linearIssueUrl(r.id)} target="_blank" rel="noreferrer" className={`text-text ${linkCls}`}>
            {r.title}
          </a>
        ),
      },
      {
        key: "status",
        label: "Status",
        sortValue: (r) => STATUS_WEIGHT[r.status === "In Progress" ? "In Progress" : r.priority] ?? 9,
        render: (r) =>
          r.status === "In Progress" ? (
            <Badge variant="success">In progress</Badge>
          ) : (
            <Badge variant={PRIORITY_VARIANT[r.priority]}>{r.priority}</Badge>
          ),
      },
      {
        key: "created",
        label: "Created",
        align: "right",
        sortValue: (r) => r.created,
        render: (r) => <span className="tabular-nums text-text-body">{formatDate(`${r.created}T12:00:00`)}</span>,
      },
    ],
    [],
  );

  // Gentle, continuous auto-scroll of the bounded rows region. The scroller is
  // the Table primitive's own overflow-auto element (fillHeight makes the header
  // sticky over it); nudge its scrollTop a fraction each frame and reverse at
  // each end. Held at rest under reduced-motion and while the pointer is over it.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const scroller = wrapRef.current?.querySelector<HTMLElement>(".overflow-auto");
    if (!scroller) return;
    let dir = 1;
    let raf = 0;
    const step = () => {
      if (!pausedRef.current) {
        const max = scroller.scrollHeight - scroller.clientHeight;
        if (max > 1) {
          scroller.scrollTop += 0.4 * dir;
          if (scroller.scrollTop >= max) dir = -1;
          else if (scroller.scrollTop <= 0) dir = 1;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const rowActions = (r: BacklogIssue) => {
    const pinned = isPinned(r.id);
    return (
      <button
        type="button"
        onClick={() => toggle(r.id)}
        disabled={!pinned && full}
        aria-pressed={pinned}
        title={pinned ? "Unpin" : full ? "Three issues already pinned" : "Pin to the top"}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-field transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          pinned ? "text-primary" : "text-text-muted hover:text-text"
        }`}
      >
        <Icon name="pin" size={15} />
      </button>
    );
  };

  return (
    <div
      ref={wrapRef}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      className="flex h-[480px] min-h-0 min-w-0 flex-col"
    >
      <DataTable columns={columns} rows={BACKLOG} rowKey={(r) => r.id} rowActions={rowActions} stacked fillHeight />
    </div>
  );
}

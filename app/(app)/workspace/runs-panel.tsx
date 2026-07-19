"use client";

import { useEffect, useRef, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Tabs } from "@/components/ui/tabs";
import type { ReportEntry } from "@/lib/repos/reports";
import type { SyncRun } from "@/lib/repos/sync-runs";
import { ReportsTable } from "./reports-table";
import { runColumns } from "./run-history";
import { WorkQueue } from "./work-queue";

// The operations ledger as one tabbed panel: the harvest runner, the full run
// history, the reports the fleet has filed, and the work queue — four tables
// that used to stack, now one tab each (the founder's dev-tools mock). Switching
// tabs flashes a table-shaped skeleton — the /Code/sports loading pattern,
// animate-pulse bars sized to the rows about to land — so the swap reads as a
// load, not a jump.

type TabKey = "harvest" | "history" | "reports" | "queue";

const TABS = [
  { key: "harvest", label: "Harvest Runs" },
  { key: "history", label: "History Logs" },
  { key: "reports", label: "Agent Reports" },
  { key: "queue", label: "Work queue" },
];

// How long the skeleton holds on a tab switch — long enough to register as a
// load, short enough to stay out of the way.
const SWAP_MS = 420;

/** A table-shaped placeholder — a header rule over a stack of pulse rows, sized
 *  to the stacked DataTable it stands in for. Tokens only, animate-pulse. */
function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface" aria-hidden>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <span className="h-3.5 w-40 animate-pulse rounded bg-canvas" />
        <span className="ml-auto h-3.5 w-24 animate-pulse rounded bg-canvas" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <span className="h-3 w-28 animate-pulse rounded bg-canvas" />
            <span className="hidden h-3 w-48 animate-pulse rounded bg-canvas sm:block" />
            <span className="ml-auto h-3 w-16 animate-pulse rounded bg-canvas" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RunsPanel({
  harvests,
  runs,
  reports,
}: {
  harvests: SyncRun[];
  runs: SyncRun[];
  reports: ReportEntry[];
}) {
  const [active, setActive] = useState<TabKey>("harvest");
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function select(key: string) {
    const k = key as TabKey;
    if (k === active) return;
    setActive(k);
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLoading(false), SWAP_MS);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Tabs items={TABS} active={active} onChange={select} slideActive />
      {loading ? (
        <TableSkeleton />
      ) : active === "harvest" ? (
        <DataTable
          columns={runColumns}
          rows={harvests}
          rowKey={(h) => h.id}
          defaultSort={{ col: "started", dir: "desc" }}
          stacked
        />
      ) : active === "history" ? (
        <DataTable
          columns={runColumns}
          rows={runs}
          rowKey={(r) => r.id}
          defaultSort={{ col: "started", dir: "desc" }}
          stacked
        />
      ) : active === "reports" ? (
        <ReportsTable reports={reports} />
      ) : (
        <WorkQueue />
      )}
    </div>
  );
}

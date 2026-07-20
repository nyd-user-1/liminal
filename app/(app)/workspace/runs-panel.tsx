"use client";

import { useEffect, useRef, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Tabs } from "@/components/ui/tabs";
import type { ReportEntry } from "@/lib/repos/reports";
import type { SyncRun } from "@/lib/repos/sync-runs";
import { AnthemJune } from "./anthem-june";
import { HarvestAnatomyDialog } from "./harvest-anatomy-dialog";
import { ReportsTable } from "./reports-table";
import { runColumns } from "./run-history";
import { WorkQueue } from "./work-queue";

// The operations ledger as one tabbed panel: the harvest runner, the full run
// history, the reports the fleet has filed, the work queue, and the Anthem-June
// raw rows — five tables sharing one same-height region (REGION_H). Each renders
// exactly ~8 rows under its header and scrolls the rest by hand (fillHeight); the
// Work queue used to auto-scroll and no longer does (TASK-WORKSPACE-V4 T1).
// A click on a Harvest Runs row opens its anatomy dialog (T3). Switching tabs
// flashes a table-shaped skeleton so the swap reads as a load, not a jump.

type TabKey = "harvest" | "history" | "reports" | "queue" | "anthem";

const TABS = [
  { key: "harvest", label: "Harvest Runs" },
  { key: "history", label: "History Logs" },
  { key: "reports", label: "Agent Reports" },
  { key: "queue", label: "Work queue" },
  { key: "anthem", label: "Anthem-June" },
];

// One height for every tab's table region — 8 rows under the header, the rest
// reachable by scrolling inside the card. Tuned to the DataTable row height.
const REGION_H = "h-[356px]";

// How long the skeleton holds on a tab switch — long enough to register as a
// load, short enough to stay out of the way.
const SWAP_MS = 420;

/** A table-shaped placeholder that fills the shared region — a header rule over a
 *  stack of pulse rows. Tokens only, animate-pulse. */
function TableSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card" aria-hidden>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <span className="h-3.5 w-40 animate-pulse rounded bg-canvas" />
        <span className="ml-auto h-3.5 w-24 animate-pulse rounded bg-canvas" />
      </div>
      <div className="flex-1 divide-y divide-border overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
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
  const [openJob, setOpenJob] = useState<string | null>(null);
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
      {/* One height-bounded region every tab fills — the same-height table
          region T1 asks for. fillHeight tables scroll their rows under a sticky
          header inside this box. */}
      <div className={`${REGION_H} flex min-h-0 min-w-0 flex-col`}>
        {loading ? (
          <TableSkeleton />
        ) : active === "harvest" ? (
          <DataTable
            columns={runColumns}
            rows={harvests}
            rowKey={(h) => h.id}
            defaultSort={{ col: "started", dir: "desc" }}
            onRowClick={(h) => setOpenJob(h.job)}
            stacked
            fillHeight
          />
        ) : active === "history" ? (
          <DataTable
            columns={runColumns}
            rows={runs}
            rowKey={(r) => r.id}
            defaultSort={{ col: "started", dir: "desc" }}
            stacked
            fillHeight
          />
        ) : active === "reports" ? (
          <ReportsTable reports={reports} />
        ) : active === "queue" ? (
          <WorkQueue />
        ) : (
          <AnthemJune />
        )}
      </div>
      {openJob && <HarvestAnatomyDialog job={openJob} onClose={() => setOpenJob(null)} />}
    </div>
  );
}

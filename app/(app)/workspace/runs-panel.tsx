"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import type { ReportEntry } from "@/lib/repos/reports";
import type { SyncHealth, SyncRun } from "@/lib/repos/sync-runs";
import { AnthemJune } from "./anthem-june";
import { HarvestAnatomyDialog } from "./harvest-anatomy-dialog";
import { ReportsTable } from "./reports-table";
import { RunsTable } from "./run-history";
import { WorkQueue } from "./work-queue";

// The operations ledger as one tabbed panel: the harvest runner, the full run
// history, the reports the fleet has filed, the work queue, and the Anthem-June
// raw rows — five tables sharing one same-height region (REGION_H). Each renders
// exactly ~10 rows under its header and scrolls the rest by hand (fillHeight).
// TABLE STANDARD v2 (2026-07-20): the standalone Sync-health card that used to
// sit above this is gone — the nightly's health now rides in the Harvest-runs
// title block, and every table names itself + stamps its own source/freshness.
// A click on a Harvest Runs row opens its anatomy dialog. Switching tabs flashes
// a table-shaped skeleton so the swap reads as a load, not a jump.

type TabKey = "harvest" | "history" | "reports" | "queue" | "anthem";

const TABS = [
  { key: "harvest", label: "Harvest Runs" },
  { key: "history", label: "History Logs" },
  { key: "reports", label: "Agent Reports" },
  { key: "queue", label: "Work queue" },
  { key: "anthem", label: "Anthem-June" },
];

// One height for every tab's table region — 10 rows under the header (up from 8,
// TABLE STANDARD v2), the rest reachable by scrolling inside the card. Tuned to
// the DataTable row height plus the v2 title header and source/freshness footer.
const REGION_H = "h-[544px]";

// How long the skeleton holds on a tab switch — long enough to register as a
// load, short enough to stay out of the way.
const SWAP_MS = 420;

// The nightly's standing, in the same words the deleted Sync-health card used.
const NIGHTLY_LABEL: Record<SyncRun["state"], string> = {
  ok: "Healthy",
  error: "Failed",
  died: "Died mid-run",
  running: "Running",
};

/** The nightly run's one-line meta — the card's old sub-line, now the Harvest-runs
 *  title-block sub-line. */
function runMeta(run: SyncRun): string {
  const parts = [formatDateTime(run.startedAt), run.trigger];
  if (run.durationMs !== null) parts.push(`${Math.round(run.durationMs / 1000)}s`);
  if (run.steps.length > 0)
    parts.push(`${run.steps.length} steps${run.failedSteps.length > 0 ? `, ${run.failedSteps.length} failed` : ""}`);
  return parts.join(" · ");
}

/** A table-shaped placeholder that fills the shared region — a header rule over a
 *  stack of pulse rows and a footer rule. Tokens only, animate-pulse. */
function TableSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card" aria-hidden>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <span className="h-2 w-2 animate-pulse rounded-full bg-canvas" />
        <span className="h-3.5 w-32 animate-pulse rounded bg-canvas" />
        <span className="ml-auto h-9 w-56 animate-pulse rounded-field bg-canvas" />
      </div>
      <div className="flex-1 divide-y divide-border overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <span className="h-3 w-28 animate-pulse rounded bg-canvas" />
            <span className="hidden h-3 w-48 animate-pulse rounded bg-canvas sm:block" />
            <span className="ml-auto h-3 w-16 animate-pulse rounded bg-canvas" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <span className="h-3 w-40 animate-pulse rounded bg-canvas" />
        <span className="h-3 w-28 animate-pulse rounded bg-canvas" />
      </div>
    </div>
  );
}

export function RunsPanel({
  health,
  runs,
  reports,
}: {
  health: SyncHealth;
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

  // The nightly matview health, folded out of the deleted card into the
  // Harvest-runs title block — the first Operations table an admin sees.
  const { nightly, nightlyStale, harvests } = health;
  const nightlyRed = nightly !== null && (nightly.state === "error" || nightly.state === "died" || nightlyStale);
  const nightlyStatus =
    nightly === null
      ? { variant: "warning" as const, label: "No runs yet" }
      : {
          variant: nightlyRed ? ("danger" as const) : nightly.state === "running" ? ("warning" as const) : ("success" as const),
          label: nightlyStale && nightly.state === "ok" ? "Stopped" : NIGHTLY_LABEL[nightly.state],
        };
  const nightlyMeta = nightly ? runMeta(nightly) : "The cron fires daily at 4:12 AM ET";

  const historyFailing = runs.filter((r) => r.state === "error" || r.state === "died").length;
  const stamp = (rows: SyncRun[]) => (rows.length ? formatDateTime(rows[0].startedAt) : "no runs yet");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Tabs items={TABS} active={active} onChange={select} slideActive />
      {/* One height-bounded region every tab fills — the same-height table
          region. fillHeight tables scroll their rows under a sticky header
          inside this box. */}
      <div className={`${REGION_H} flex min-h-0 min-w-0 flex-col`}>
        {loading ? (
          <TableSkeleton />
        ) : active === "harvest" ? (
          <RunsTable
            rows={harvests}
            title="Harvest runs"
            status={nightlyStatus}
            titleMeta={nightlyMeta}
            source="sync_runs · harvest:* jobs"
            updatedAt={stamp(harvests)}
            onRowClick={(h) => setOpenJob(h.job)}
            searchPlaceholder="Search harvests"
            exportName="harvest-runs"
          />
        ) : active === "history" ? (
          <RunsTable
            rows={runs}
            title="History logs"
            status={
              historyFailing
                ? { variant: "warning", label: `${runs.length} runs · ${historyFailing} failed` }
                : { variant: "success", label: `${runs.length} runs` }
            }
            source="sync_runs ledger · newest 30"
            updatedAt={stamp(runs)}
            searchPlaceholder="Search runs"
            exportName="run-history"
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

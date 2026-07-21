"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { SidePanel } from "@/components/ui/side-panel";
import { SquareMeter, useCountUp } from "@/components/ui/square-meter";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Td, Tr } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import type { CheckStatus, MonitorCheck, MonitorMeter, MonitorSnapshot } from "@/lib/repos/monitor";

// The /monitor surface. Everything it renders arrives from the server already
// measured (lib/repos/monitor.ts) — this file decides only how it reads.
//
// The organising idea, from the founder's reference screens: rows are GROUPED
// BY STATUS, not listed flat. What needs attention is at the top under its own
// header, and a healthy system collapses into a short green list you can skim
// past. Every panel names the view its number came from.

const BADGE: Record<CheckStatus, "danger" | "warning" | "success" | "neutral"> = {
  failing: "danger",
  warning: "warning",
  healthy: "success",
  unknown: "neutral",
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  failing: "Failing",
  warning: "Needs attention",
  healthy: "Healthy",
  unknown: "Unknown",
};

function relative(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/** The grid-of-squares tile: the meter, its reading, and where it came from. */
function MeterTile({ meter }: { meter: MonitorMeter }) {
  const eased = useCountUp(meter.pct);
  return (
    <Card className="flex h-full min-w-0 flex-col gap-4 p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="truncate text-sm font-medium text-text">{meter.label}</span>
        <span className="shrink-0 text-[22px] font-bold leading-none tabular-nums text-text">
          {meter.pct === null ? "—" : `${Math.round(eased)}%`}
        </span>
      </div>
      <SquareMeter value={meter.pct} state={meter.state} />
      <div className="mt-auto text-[13px] text-text-muted">
        <span className="text-text-body">{meter.primary}</span> · {meter.secondary}
      </div>
    </Card>
  );
}

/** One check as a clickable row. The whole row opens the detail panel. */
function CheckRow({ check, onOpen }: { check: MonitorCheck; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full min-w-0 items-center gap-3 rounded-field px-3 py-2.5 text-left transition-colors hover:bg-black/[0.04]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text">{check.label}</span>
        <span className="block truncate text-[13px] text-text-muted">{check.detail}</span>
      </span>
      <span className="shrink-0 font-mono text-[13px] tabular-nums text-text-body">{check.value}</span>
      <Badge variant={BADGE[check.status]}>{STATUS_LABEL[check.status]}</Badge>
      <Icon name="chevron-right" size={16} className="shrink-0 text-text-muted" />
    </button>
  );
}

export function MonitorView({ snapshot }: { snapshot: MonitorSnapshot }) {
  const [openCheck, setOpenCheck] = useState<MonitorCheck | null>(null);

  const failing = snapshot.checks.filter((c) => c.status === "failing");
  const warning = snapshot.checks.filter((c) => c.status === "warning");
  const healthy = snapshot.checks.filter((c) => c.status === "healthy" || c.status === "unknown");
  const staleViews = snapshot.matviews.filter((m) => m.status !== "healthy");
  const sickJobs = snapshot.jobs.filter((j) => j.health !== "healthy");

  // Status groups, worst first, empty groups omitted — a "Failing (0)" header is
  // noise on a healthy system.
  const groups: Array<{ status: CheckStatus; items: MonitorCheck[] }> = [
    { status: "failing" as const, items: failing },
    { status: "warning" as const, items: warning },
    { status: "healthy" as const, items: healthy },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto flex min-w-0 max-w-[1200px] flex-col gap-5">
      <p className="max-w-3xl text-sm leading-relaxed text-text-muted">
        Live health for the database this deployment is connected to, read from the server&apos;s own statistics views —
        no agent, no external service. Every figure names the view it came from. Thresholds live in one place
        (<span className="font-mono text-[13px] text-text-body">THRESHOLDS</span> in{" "}
        <span className="font-mono text-[13px] text-text-body">lib/repos/monitor.ts</span>), so tuning this page is a
        single edit.
      </p>

      {/* ── attention header: counts that turn red when they need action ── */}
      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Checks failing"
          value={<span className={failing.length ? "text-danger" : undefined}>{failing.length}</span>}
        />
        <StatCard
          label="Needs attention"
          value={<span className={warning.length ? "text-warning" : undefined}>{warning.length}</span>}
        />
        <StatCard
          label="Views past cadence"
          value={<span className={staleViews.length ? "text-warning" : undefined}>{staleViews.length}</span>}
        />
        <StatCard
          label="Jobs not healthy"
          value={<span className={sickJobs.length ? "text-warning" : undefined}>{sickJobs.length}</span>}
        />
      </div>

      {/* ── the meters ── */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.meters.map((m) => (
          <MeterTile key={m.id} meter={m} />
        ))}
      </div>

      {/* ── checks, grouped by status ── */}
      <Card className="min-w-0 p-2">
        {groups.map((g) => (
          <div key={g.status} className="min-w-0">
            <div className="flex items-center gap-2 px-3 pb-1 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {STATUS_LABEL[g.status]}
              </span>
              <span className="font-mono text-[11px] text-text-muted">{g.items.length}</span>
            </div>
            {g.items.map((c) => (
              <CheckRow key={c.id} check={c} onOpen={() => setOpenCheck(c)} />
            ))}
          </div>
        ))}
        <div className="border-t border-border px-3 py-2 text-[12px] text-text-muted">
          {snapshot.checks.length} checks · read from pg_stat_activity, pg_stat_database, pg_stat_user_tables,
          pg_matviews and sync_runs · measured {relative(snapshot.generatedAt)}
        </div>
      </Card>

      {/* ── materialized views ── */}
      <Table
        head={["View", "Size", "Last rebuilt", "Status"]}
        footer={
          <div className="px-3 py-2 text-[12px] text-text-muted">
            {snapshot.matviews.length} views · rebuild time from the nightly job&apos;s own ledger (sync_runs steps) —
            Postgres does not record when a REFRESH last ran
          </div>
        }
      >
        {snapshot.matviews.map((m) => (
          <Tr key={m.name}>
            <Td className="font-mono text-[13px]">{m.name}</Td>
            <Td className="tabular-nums text-text-body">{m.size}</Td>
            <Td className="text-text-body">
              {m.lastRefresh ? (
                <Tooltip label={new Date(m.lastRefresh).toLocaleString()}>
                  <span>{relative(m.lastRefresh)}</span>
                </Tooltip>
              ) : (
                <span className="text-text-muted">no record</span>
              )}
            </Td>
            <Td>
              <Badge variant={BADGE[m.status]}>{STATUS_LABEL[m.status]}</Badge>
            </Td>
          </Tr>
        ))}
      </Table>

      {/* ── nightly jobs ── */}
      <Table
        head={["Job", "Last run", "Duration", "Status"]}
        footer={
          <div className="px-3 py-2 text-[12px] text-text-muted">
            {snapshot.jobs.length} jobs · most recent run per job · sync_runs
          </div>
        }
      >
        {snapshot.jobs.map((j) => (
          <Tr key={j.job}>
            <Td className="font-mono text-[13px]">{j.job}</Td>
            <Td className="text-text-body">
              {j.lastRun ? (
                <Tooltip label={new Date(j.lastRun).toLocaleString()}>
                  <span>{relative(j.lastRun)}</span>
                </Tooltip>
              ) : (
                <span className="text-text-muted">never</span>
              )}
            </Td>
            <Td className="tabular-nums text-text-body">
              {j.durationMs === null
                ? "—"
                : j.durationMs >= 60_000
                  ? `${(j.durationMs / 60_000).toFixed(1)}m`
                  : `${(j.durationMs / 1000).toFixed(1)}s`}
            </Td>
            <Td>
              <Badge variant={BADGE[j.health]}>{j.status === "error" ? "Error" : STATUS_LABEL[j.health]}</Badge>
            </Td>
          </Tr>
        ))}
      </Table>

      {/* ── long-running queries ── */}
      <Card className="min-w-0 p-4">
        <div className="flex items-center justify-between gap-3 pb-2">
          <span className="text-sm font-medium text-text">Long-running queries</span>
          <span className="font-mono text-[11px] text-text-muted">{snapshot.longQueries.length}</span>
        </div>
        {snapshot.longQueries.length === 0 ? (
          <EmptyState icon="check" title="Nothing running over 15 seconds" />
        ) : (
          <div className="flex min-w-0 flex-col gap-2">
            {snapshot.longQueries.map((q) => (
              <div key={q.pid} className="min-w-0 rounded-field bg-canvas p-3">
                <div className="flex items-center gap-2 pb-1">
                  <span className="font-mono text-[12px] text-text-muted">pid {q.pid}</span>
                  <span className="font-mono text-[12px] tabular-nums text-text-body">{q.seconds}s</span>
                  <span className="font-mono text-[12px] text-text-muted">{q.state}</span>
                  {/* Slow on purpose — shown, but it never decides the status. */}
                  {q.maintenance && <Badge variant="neutral">maintenance</Badge>}
                </div>
                <div className="overflow-x-auto">
                  <code className="whitespace-pre text-[12px] text-text-body">{q.query}</code>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="pt-2 text-[12px] text-text-muted">
          pg_stat_activity · string literals are masked inside the query itself, so no value in a WHERE clause can
          reach this page
        </div>
      </Card>

      {/* ── storage + unused indexes ── */}
      <Table
        head={["Unused index", "On table", "Size"]}
        footer={
          <div className="px-3 py-2 text-[12px] text-text-muted">
            Database size {snapshot.databaseSize ?? "unknown"} · indexes over 1 MB with zero recorded scans ·
            pg_stat_user_indexes. Zero scans since the last statistics reset — a young index has simply not been used
            yet, so read this as a question rather than a verdict.
          </div>
        }
      >
        {snapshot.unusedIndexes.length === 0 ? (
          <Tr>
            <Td colSpan={3} className="text-text-muted">
              Every index over 1 MB has been scanned at least once.
            </Td>
          </Tr>
        ) : (
          snapshot.unusedIndexes.map((i) => (
            <Tr key={i.index}>
              <Td className="font-mono text-[13px]">{i.index}</Td>
              <Td className="font-mono text-[13px] text-text-body">{i.table}</Td>
              <Td className="tabular-nums text-text-body">{i.size}</Td>
            </Tr>
          ))
        )}
      </Table>

      {/* ── Neon control plane: honestly gated ── */}
      <Card className="min-w-0 p-4">
        <div className="flex items-start gap-3">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-text-muted" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-text">
              Compute hours, storage and branch state — not configured
            </div>
            <p className="pt-1 text-[13px] leading-relaxed text-text-muted">
              {snapshot.neon.reason} To switch these panels on, create a Neon API key at{" "}
              <span className="font-mono text-[12px] text-text-body">console.neon.tech → Account settings → API keys</span>{" "}
              and add it as <span className="font-mono text-[12px] text-text-body">NEON_API_KEY</span> in{" "}
              <span className="font-mono text-[12px] text-text-body">.env.local</span> and in the Vercel project
              (Settings → Environment Variables). Until then this panel stays empty rather than showing a number nobody
              measured.
            </p>
          </div>
        </div>
      </Card>

      {/* ── the detail view ── */}
      <SidePanel
        open={openCheck !== null}
        onClose={() => setOpenCheck(null)}
        title={openCheck?.label ?? ""}
        kicker={openCheck ? STATUS_LABEL[openCheck.status] : undefined}
      >
        {openCheck && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <Badge variant={BADGE[openCheck.status]}>{STATUS_LABEL[openCheck.status]}</Badge>
              <span className="font-mono text-sm tabular-nums text-text">{openCheck.value}</span>
            </div>

            <div>
              <div className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                What this measures
              </div>
              <p className="text-sm leading-relaxed text-text-body">{openCheck.detail}</p>
            </div>

            <div>
              <div className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Threshold</div>
              <p className="text-sm leading-relaxed text-text-body">{openCheck.threshold}</p>
            </div>

            <div>
              <div className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                What to do about it
              </div>
              <p className="text-sm leading-relaxed text-text-body">{openCheck.remediation}</p>
            </div>

            <div>
              <div className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Source</div>
              <p className="font-mono text-[13px] text-text-body">{openCheck.source}</p>
              <p className="pt-1 text-[12px] text-text-muted">Measured {relative(snapshot.generatedAt)}.</p>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}

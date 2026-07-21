"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { SidePanel } from "@/components/ui/side-panel";
import { SquareMeter, useCountUp } from "@/components/ui/square-meter";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import type { CheckStatus, MonitorCheck, MonitorMeter, MonitorSnapshot } from "@/lib/repos/monitor";

// The /monitor surface. Everything it renders arrives from the server already
// measured (lib/repos/monitor.ts) — this file decides only how it reads.
//
// Layout, after the founder's corrections: the page OPENS with the numbers —
// four state-coloured summary cards, then the meters, then one tabbed table
// section. The explanation of the numbers is a footnote at the bottom, because
// a reader who needs it will scroll and a reader who doesn't shouldn't have to.
//
// The five tables that used to stack down the page are now tabs over a single
// fixed-height region, so switching between them never jumps the page.

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

/** Worst-first, so the row that needs a human is the row you land on. */
const STATUS_RANK: Record<CheckStatus, number> = { failing: 0, warning: 1, unknown: 2, healthy: 3 };

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

const duration = (ms: number | null) =>
  ms === null ? "—" : ms >= 60_000 ? `${(ms / 60_000).toFixed(1)}m` : `${(ms / 1000).toFixed(1)}s`;

/**
 * A summary card that carries its own state.
 *
 * A count of zero is the GOOD outcome here, so it reads green rather than
 * neutral — the founder's point was that a healthy board should be reassuring
 * at a glance, not merely quiet. `tone` says which direction is bad, because
 * "0 failing" is success while a zero elsewhere might not be.
 */
function SummaryCard({
  label,
  count,
  severity,
}: {
  label: string;
  count: number;
  /** What a NON-zero count means: needs addressing now, or worth a look. */
  severity: "danger" | "warning";
}) {
  const state: "success" | "warning" | "danger" = count === 0 ? "success" : severity;
  // The same success/warning/danger tokens the meter squares use — no new palette.
  const TONE = {
    success: { value: "text-success", ring: "border-success/30 bg-success-tint/40", dot: "bg-success" },
    warning: { value: "text-warning", ring: "border-warning/40 bg-warning-tint/40", dot: "bg-warning" },
    danger: { value: "text-danger", ring: "border-danger/40 bg-danger-tint/40", dot: "bg-danger" },
  }[state];

  return (
    <StatCard
      className={`border ${TONE.ring}`}
      label={label}
      // The dot rides in the primitive's own corner slot rather than forcing an
      // element through `label`, which is typed as a plain string.
      corner={<span className={`block size-2 rounded-full ${TONE.dot}`} />}
      value={<span className={TONE.value}>{count}</span>}
    />
  );
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

/**
 * One tab's table, in the standing v2 anatomy: title + status left, search
 * right beside the utilities kebab, source bottom-left and freshness
 * bottom-right, a leading select column, sortable headers and a trailing
 * actions cell — all of which `DataTable` already implements, so this only
 * wires them.
 *
 * These are small, already-in-memory sets (6 to 25 rows), so search and sort
 * are client-side. The v2 lightning stack — server pagination, indexed search,
 * a matview past 10k rows — is for the big index tables and would be pure
 * ceremony on a 12-row list of materialized views.
 */
function MonitorTable<T>({
  title,
  status,
  rows,
  columns,
  rowKey,
  search,
  source,
  updatedAt,
  defaultSort,
  onRowClick,
  rowActions,
}: {
  title: string;
  status: { variant: "neutral" | "success" | "warning" | "danger"; label: string };
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  /** Fields searched, joined and lowercased. */
  search: (row: T) => string;
  source: string;
  updatedAt: string;
  defaultSort?: { col: string; dir: "asc" | "desc" };
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => search(r).toLowerCase().includes(q)) : rows;
  }, [rows, query, search]);

  return (
    <DataTable
      stacked
      fillHeight
      title={title}
      status={status}
      columns={columns}
      rows={filtered}
      rowKey={rowKey}
      defaultSort={defaultSort}
      onRowClick={onRowClick}
      rowActions={rowActions}
      selected={selected}
      onSelectedChange={setSelected}
      collapseActions
      // With `title` set, DataTable moves this to the right group, immediately
      // before the kebab — the v2 position.
      toolbarLeft={
        <SearchInput
          className="w-56"
          placeholder={`Search ${title.toLowerCase()}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      }
      source={source}
      updatedAt={query ? `${filtered.length} of ${rows.length} rows · ${updatedAt}` : `${rows.length} rows · ${updatedAt}`}
    />
  );
}

export function MonitorView({ snapshot }: { snapshot: MonitorSnapshot }) {
  const [openCheck, setOpenCheck] = useState<MonitorCheck | null>(null);
  const [tab, setTab] = useState("checks");

  const failing = snapshot.checks.filter((c) => c.status === "failing");
  const warning = snapshot.checks.filter((c) => c.status === "warning");
  const staleViews = snapshot.matviews.filter((m) => m.status !== "healthy");
  const sickJobs = snapshot.jobs.filter((j) => j.health !== "healthy");

  const measured = relative(snapshot.generatedAt);
  const worstOf = (s: CheckStatus[]): CheckStatus =>
    s.includes("failing") ? "failing" : s.includes("warning") ? "warning" : s.includes("unknown") ? "unknown" : "healthy";

  const statusPill = (s: CheckStatus) => ({ variant: BADGE[s], label: STATUS_LABEL[s] }) as const;

  // ── columns, one set per tab ──
  const checkCols: DataTableColumn<MonitorCheck>[] = [
    { key: "label", label: "Check", render: (r) => <span className="font-medium text-text">{r.label}</span>, sortValue: (r) => r.label },
    { key: "value", label: "Measured", render: (r) => <span className="font-mono text-[13px] tabular-nums">{r.value}</span>, sortValue: (r) => r.value },
    { key: "threshold", label: "Threshold", render: (r) => <span className="text-text-muted">{r.threshold}</span>, sortValue: (r) => r.threshold },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge variant={BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
      sortValue: (r) => STATUS_RANK[r.status],
    },
  ];

  const viewCols: DataTableColumn<(typeof snapshot.matviews)[number]>[] = [
    { key: "name", label: "View", render: (r) => <span className="font-mono text-[13px]">{r.name}</span>, sortValue: (r) => r.name },
    { key: "size", label: "Size", align: "right", render: (r) => <span className="tabular-nums">{r.size}</span>, sortValue: (r) => r.name },
    {
      key: "rebuilt",
      label: "Last rebuilt",
      render: (r) =>
        r.lastRefresh ? (
          <Tooltip label={new Date(r.lastRefresh).toLocaleString()}>
            <span>{relative(r.lastRefresh)}</span>
          </Tooltip>
        ) : (
          <span className="text-text-muted">no record</span>
        ),
      sortValue: (r) => r.ageHours ?? Number.MAX_SAFE_INTEGER,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge variant={BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
      sortValue: (r) => STATUS_RANK[r.status],
    },
  ];

  const jobCols: DataTableColumn<(typeof snapshot.jobs)[number]>[] = [
    { key: "job", label: "Job", render: (r) => <span className="font-mono text-[13px]">{r.job}</span>, sortValue: (r) => r.job },
    {
      key: "lastRun",
      label: "Last run",
      render: (r) =>
        r.lastRun ? (
          <Tooltip label={new Date(r.lastRun).toLocaleString()}>
            <span>{relative(r.lastRun)}</span>
          </Tooltip>
        ) : (
          <span className="text-text-muted">never</span>
        ),
      sortValue: (r) => r.ageHours ?? Number.MAX_SAFE_INTEGER,
    },
    { key: "duration", label: "Duration", align: "right", render: (r) => <span className="tabular-nums">{duration(r.durationMs)}</span>, sortValue: (r) => r.durationMs ?? -1 },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge variant={BADGE[r.health]}>{r.status === "error" ? "Error" : STATUS_LABEL[r.health]}</Badge>,
      sortValue: (r) => STATUS_RANK[r.health],
    },
  ];

  const queryCols: DataTableColumn<(typeof snapshot.longQueries)[number]>[] = [
    { key: "pid", label: "PID", render: (r) => <span className="font-mono text-[13px] text-text-muted">{r.pid}</span>, sortValue: (r) => r.pid },
    { key: "seconds", label: "Running", align: "right", render: (r) => <span className="tabular-nums">{r.seconds}s</span>, sortValue: (r) => r.seconds },
    {
      key: "kind",
      label: "Kind",
      render: (r) => (r.maintenance ? <Badge variant="neutral">maintenance</Badge> : <Badge variant="info">application</Badge>),
      sortValue: (r) => (r.maintenance ? 1 : 0),
    },
    {
      key: "query",
      label: "Statement",
      // Masked in Postgres before it ever left the server — no literal here.
      render: (r) => <span className="block max-w-[520px] truncate font-mono text-[12px] text-text-body">{r.query}</span>,
      sortValue: (r) => r.query,
    },
  ];

  const indexCols: DataTableColumn<(typeof snapshot.unusedIndexes)[number]>[] = [
    { key: "index", label: "Index", render: (r) => <span className="font-mono text-[13px]">{r.index}</span>, sortValue: (r) => r.index },
    { key: "table", label: "On table", render: (r) => <span className="font-mono text-[13px] text-text-body">{r.table}</span>, sortValue: (r) => r.table },
    { key: "size", label: "Size", align: "right", render: (r) => <span className="tabular-nums">{r.size}</span>, sortValue: (r) => r.index },
  ];

  const TABS = [
    { key: "checks", label: "Checks", count: snapshot.checks.length },
    { key: "views", label: "Views", count: snapshot.matviews.length },
    { key: "jobs", label: "Jobs", count: snapshot.jobs.length },
    { key: "queries", label: "Queries", count: snapshot.longQueries.length },
    { key: "indexes", label: "Unused indexes", count: snapshot.unusedIndexes.length },
  ];

  return (
    // Matches /workspace exactly — same max width, same gap — so the body's left
    // edge lines up when tabbing between the two pages.
    <div className="mx-auto flex min-w-0 max-w-[1400px] flex-col gap-6">
      {/* ── attention header: each card carries its own state ── */}
      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Checks failing" count={failing.length} severity="danger" />
        <SummaryCard label="Needs attention" count={warning.length} severity="warning" />
        <SummaryCard label="Views past cadence" count={staleViews.length} severity="warning" />
        <SummaryCard label="Jobs not healthy" count={sickJobs.length} severity="warning" />
      </div>

      {/* ── the meters ── */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.meters.map((m) => (
          <MeterTile key={m.id} meter={m} />
        ))}
      </div>

      {/* ── one tabbed region, one fixed height ──
          Every tab shares this wrapper's height so switching never reflows the
          page. `fillHeight` bounds each table to it and scrolls the ROWS under
          a sticky header — ten visible, the rest by hand. */}
      <div className="flex min-w-0 flex-col gap-3">
        <Tabs items={TABS} active={tab} onChange={setTab} slideActive />
        <div className="flex h-[560px] min-h-0 min-w-0 flex-col">
          {tab === "checks" && (
            <MonitorTable
              title="Checks"
              status={statusPill(worstOf(snapshot.checks.map((c) => c.status)))}
              rows={snapshot.checks}
              columns={checkCols}
              rowKey={(r) => r.id}
              search={(r) => `${r.label} ${r.value} ${r.detail}`}
              defaultSort={{ col: "status", dir: "asc" }}
              onRowClick={(r) => setOpenCheck(r)}
              rowActions={(r) => (
                <KebabMenu>
                  <MenuItem icon="eye" label="Open detail" onClick={() => setOpenCheck(r)} />
                </KebabMenu>
              )}
              source="pg_stat_activity · pg_stat_user_tables · pg_matviews · sync_runs"
              updatedAt={`measured ${measured}`}
            />
          )}
          {tab === "views" && (
            <MonitorTable
              title="Materialized view freshness"
              status={statusPill(worstOf(snapshot.matviews.map((m) => m.status)))}
              rows={snapshot.matviews}
              columns={viewCols}
              rowKey={(r) => r.name}
              search={(r) => r.name}
              defaultSort={{ col: "status", dir: "asc" }}
              source="pg_matviews · rebuild time from sync_runs steps"
              updatedAt={`measured ${measured}`}
            />
          )}
          {tab === "jobs" && (
            <MonitorTable
              title="Nightly jobs"
              status={statusPill(worstOf(snapshot.jobs.map((j) => j.health)))}
              rows={snapshot.jobs}
              columns={jobCols}
              rowKey={(r) => r.job}
              search={(r) => `${r.job} ${r.status}`}
              defaultSort={{ col: "status", dir: "asc" }}
              source="sync_runs · most recent run per job"
              updatedAt={`measured ${measured}`}
            />
          )}
          {tab === "queries" && (
            <MonitorTable
              title="Long-running queries"
              status={
                snapshot.longQueries.some((q) => !q.maintenance)
                  ? { variant: "warning", label: "Application query running" }
                  : { variant: "success", label: "Nothing over 15s" }
              }
              rows={snapshot.longQueries}
              columns={queryCols}
              rowKey={(r) => String(r.pid)}
              search={(r) => r.query}
              defaultSort={{ col: "seconds", dir: "desc" }}
              source="pg_stat_activity · string literals masked in Postgres"
              updatedAt={`measured ${measured}`}
            />
          )}
          {tab === "indexes" && (
            <MonitorTable
              title="Unused indexes"
              status={{ variant: "neutral", label: "Informational" }}
              rows={snapshot.unusedIndexes}
              columns={indexCols}
              rowKey={(r) => r.index}
              search={(r) => `${r.index} ${r.table}`}
              defaultSort={{ col: "index", dir: "asc" }}
              source="pg_stat_user_indexes · over 1 MB, zero recorded scans"
              updatedAt={`database ${snapshot.databaseSize ?? "unknown"} · measured ${measured}`}
            />
          )}
        </div>
      </div>

      {/* ── readings: measured, shown, and deliberately not judged ── */}
      {snapshot.stats.length > 0 && (
        <Card className="min-w-0 p-4">
          <div className="flex items-center gap-2 pb-1">
            <span className="text-sm font-medium text-text">Readings</span>
            <span className="text-[12px] text-text-muted">measured, not judged — no thresholds, no alerts</span>
          </div>
          <div className="flex min-w-0 flex-col divide-y divide-border">
            {snapshot.stats.map((s) => (
              <div key={s.id} className="min-w-0 py-3">
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-text">{s.label}</span>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-text">{s.value}</span>
                </div>
                <p className="pt-1 text-[12px] leading-relaxed text-text-muted">{s.caveat}</p>
                <p className="pt-1 font-mono text-[11px] text-text-muted">{s.source}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

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

      {/* ── what this page is, for whoever needs it — last, on purpose ── */}
      <p className="max-w-3xl text-[13px] leading-relaxed text-text-muted">
        Live health for the database this deployment is connected to, read from the server&apos;s own statistics views —
        no agent, no external service. Every figure names the view it came from. Thresholds live in one place
        (<span className="font-mono text-[12px] text-text-body">THRESHOLDS</span> in{" "}
        <span className="font-mono text-[12px] text-text-body">lib/repos/monitor.ts</span>), so tuning this page is a
        single edit.
      </p>

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

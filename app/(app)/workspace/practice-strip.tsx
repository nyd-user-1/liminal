import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow } from "@/components/ui/list-row";
import { StatCard } from "@/components/ui/stat-card";
import { formatCents, formatTime } from "@/lib/format";
import type { PracticeSnapshot } from "@/lib/repos/dashboard";
import { CopyCard } from "./copy-card";

// Layer 1 — the practice strip: the numbers a practitioner opens the day on.
// Scoped upstream in lib/repos/dashboard.ts (admin = whole practice,
// practitioner = own caseload); this file just renders what it's handed.

/** "+3 vs last week" — the comparison, not just the count. A bare number this
 *  week means nothing without last week's next to it. */
function WeekDelta({ now, prev }: { now: number; prev: number }) {
  const d = now - prev;
  if (prev === 0 && now === 0) return <span className="text-sm text-text-muted">no sessions either week</span>;
  if (d === 0) return <span className="text-sm text-text-muted">level with last week</span>;
  return (
    <span className="text-sm text-text-muted">
      <span className={d > 0 ? "font-semibold text-success" : "font-semibold text-text"}>
        {d > 0 ? "+" : ""}
        {d}
      </span>{" "}
      vs last week ({prev})
    </span>
  );
}

export function PracticeStrip({ snapshot }: { snapshot: PracticeSnapshot }) {
  const s = snapshot;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CopyCard chip="bottom" text={`Today's appointments: ${s.todayTotal}${s.todayRemaining > 0 ? ` (${s.todayRemaining} to go)` : ""}`}>
          <StatCard
            label="Today's appointments"
            value={s.todayTotal}
            corner={s.todayRemaining > 0 ? <Badge variant="info">{s.todayRemaining} to go</Badge> : undefined}
          />
        </CopyCard>
        <CopyCard chip="bottom" text={`Active clients: ${s.activeClients}`}>
          <StatCard label="Active clients" value={s.activeClients} />
        </CopyCard>
        <CopyCard chip="bottom" text={`Unread messages: ${s.unreadThreads}`}>
          <StatCard
            label="Unread messages"
            value={s.unreadThreads}
            corner={s.unreadThreads > 0 ? <Badge variant="warning">Needs reply</Badge> : undefined}
          />
        </CopyCard>
        <CopyCard
          chip="bottom"
          text={`Outstanding invoices: ${formatCents(s.outstandingCents)}${s.overdueCount > 0 ? ` (${s.overdueCount} overdue)` : ""}`}
        >
          <StatCard
            label="Outstanding"
            value={formatCents(s.outstandingCents)}
            corner={s.overdueCount > 0 ? <Badge variant="danger">{s.overdueCount} overdue</Badge> : undefined}
          />
        </CopyCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CopyCard
          text={
            s.nextUp.length === 0
              ? "Next up: nothing left today"
              : `Next up: ${s.nextUp.map((a) => `${a.clientName} ${formatTime(a.startsAt)}`).join("; ")}`
          }
        >
        <Card className="flex h-full min-w-0 flex-col gap-3 p-5">
          <h3 className="text-[15px] font-semibold text-text">Next up</h3>
          {s.nextUp.length === 0 ? (
            <EmptyState icon="calendar-check" title="Nothing left today" subtext="The rest of the day is yours." />
          ) : (
            <div className="flex flex-col gap-2">
              {s.nextUp.map((a) => (
                <ListRow
                  key={a.id}
                  leading={<Avatar name={a.clientName} size="sm" />}
                  title={a.clientName}
                  meta={formatTime(a.startsAt)}
                  trailing={a.status === "confirmed" ? <Badge variant="success">Confirmed</Badge> : undefined}
                />
              ))}
            </div>
          )}
        </Card>
        </CopyCard>

        <div className="flex min-w-0 flex-col gap-4">
          <CopyCard text={`Sessions this week: ${s.sessionsThisWeek} (${s.sessionsThisWeek - s.sessionsLastWeek >= 0 ? "+" : ""}${s.sessionsThisWeek - s.sessionsLastWeek} vs last week, ${s.sessionsLastWeek})`}>
          <Card className="flex flex-col gap-1.5 p-5">
            <span className="text-sm font-medium text-text-muted">Sessions this week</span>
            <span className="text-[32px] font-bold leading-tight text-text">{s.sessionsThisWeek}</span>
            <WeekDelta now={s.sessionsThisWeek} prev={s.sessionsLastWeek} />
          </Card>
          </CopyCard>

          <CopyCard
            text={
              s.rxRouting === null
                ? "Awaiting pharmacy: e-prescribing not connected"
                : `Awaiting pharmacy: ${s.rxRouting} prescriptions still routing to a pharmacy`
            }
          >
          <Card className="flex flex-col gap-1.5 p-5">
            <span className="text-sm font-medium text-text-muted">Awaiting pharmacy</span>
            <span className="text-[32px] font-bold leading-tight text-text">{s.rxRouting ?? "—"}</span>
            <span className="text-sm text-text-muted">
              {s.rxRouting === null ? "e-prescribing not connected" : "prescriptions still routing to a pharmacy"}
            </span>
          </Card>
          </CopyCard>
        </div>
      </div>
    </div>
  );
}

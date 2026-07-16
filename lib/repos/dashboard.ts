import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";
import { mockStore } from "@/lib/mock";
import "@/lib/mock/clients";
import { hasPhoton, listAllPhotonOrders, listAllPhotonPrescriptions } from "@/lib/photon";
import type { Role } from "@/lib/types";

// dashboard.ts — the /dashboard practice strip: the six numbers a practitioner
// opens the day on. Role-scoped the same way the clients list is (admin sees
// the whole practice, a practitioner sees their own caseload) — the scope is
// applied in SQL, not filtered after the fact, so an out-of-caseload row never
// reaches the page.
//
// The platform observatory below the strip does NOT live here: it reads
// lib/repos/admin.ts (the one table registry). This file is practice data only.

/** The practice runs on NY wall-clock time. "Today" means today HERE — an 8pm
 *  session is today's, not tomorrow's, however the server's clock is set (a
 *  UTC server would roll the day over at 8pm local without this). */
const PRACTICE_TZ = "America/New_York";

export interface NextUpAppointment {
  id: string;
  clientId: string;
  clientName: string;
  startsAt: string;
  status: string;
}

export interface PracticeSnapshot {
  /** "all" = practice-wide (admin), "own" = this practitioner's caseload. */
  scope: "all" | "own";
  todayTotal: number;
  todayRemaining: number;
  nextUp: NextUpAppointment[];
  activeClients: number;
  unreadThreads: number;
  /** Billed and not yet settled, net of partial payments — matches invoiceStats(). */
  outstandingCents: number;
  overdueCount: number;
  overdueCents: number;
  sessionsThisWeek: number;
  sessionsLastWeek: number;
  /** Eight weeks of session volume, oldest first — the /analytics trend card. */
  weeklySessions: Array<{ label: string; count: number }>;
  /** Photon orders still routing to a pharmacy. null = Photon not configured or unreachable. */
  rxRouting: number | null;
}

// One flight. Every window is computed in PRACTICE_TZ: date_trunc on the local
// wall clock, then back to timestamptz for the comparison against starts_at.
const SNAPSHOT_SQL = `
  WITH bounds AS (
    SELECT date_trunc('day',  now() AT TIME ZONE $2) AS day_start,
           date_trunc('week', now() AT TIME ZONE $2) AS week_start
  ), win AS (
    SELECT (day_start AT TIME ZONE $2)                          AS today_from,
           ((day_start + interval '1 day')  AT TIME ZONE $2)    AS today_to,
           (week_start AT TIME ZONE $2)                         AS week_from,
           ((week_start - interval '1 week') AT TIME ZONE $2)   AS prev_week_from
    FROM bounds
  )
  SELECT
    (SELECT count(*) FROM appointments a, win w
      WHERE a.starts_at >= w.today_from AND a.starts_at < w.today_to
        AND a.status <> 'cancelled'
        AND ($1::uuid IS NULL OR a.practitioner_id = $1)) AS today_total,
    (SELECT count(*) FROM appointments a, win w
      WHERE a.starts_at >= now() AND a.starts_at < w.today_to
        AND a.status <> 'cancelled'
        AND ($1::uuid IS NULL OR a.practitioner_id = $1)) AS today_remaining,
    (SELECT count(*) FROM clients c
      WHERE c.status = 'active' AND ($1::uuid IS NULL OR c.primary_practitioner_id = $1)) AS active_clients,
    (SELECT count(*) FROM threads t JOIN clients c ON c.id = t.client_id
      WHERE t.status = 'open' AND ($1::uuid IS NULL OR c.primary_practitioner_id = $1)
        AND EXISTS (SELECT 1 FROM messages m
                     WHERE m.thread_id = t.id AND m.read_at IS NULL AND m.sender_id = c.user_id)) AS unread_threads,
    (SELECT COALESCE(SUM(i.total_cents - COALESCE(p.paid, 0)), 0)
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       LEFT JOIN (SELECT invoice_id, SUM(amount_cents) AS paid FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id
      WHERE i.status IN ('sent','overdue') AND ($1::uuid IS NULL OR c.primary_practitioner_id = $1)) AS outstanding_cents,
    (SELECT count(*) FROM invoices i JOIN clients c ON c.id = i.client_id
      WHERE i.status = 'overdue' AND ($1::uuid IS NULL OR c.primary_practitioner_id = $1)) AS overdue_count,
    (SELECT COALESCE(SUM(i.total_cents - COALESCE(p.paid, 0)), 0)
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       LEFT JOIN (SELECT invoice_id, SUM(amount_cents) AS paid FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id
      WHERE i.status = 'overdue' AND ($1::uuid IS NULL OR c.primary_practitioner_id = $1)) AS overdue_cents,
    (SELECT count(*) FROM appointments a, win w
      WHERE a.starts_at >= w.week_from AND a.starts_at < now()
        AND a.status IN ('completed','confirmed','scheduled')
        AND ($1::uuid IS NULL OR a.practitioner_id = $1)) AS sessions_this_week,
    (SELECT count(*) FROM appointments a, win w
      WHERE a.starts_at >= w.prev_week_from AND a.starts_at < w.week_from
        AND a.status IN ('completed','confirmed','scheduled')
        AND ($1::uuid IS NULL OR a.practitioner_id = $1)) AS sessions_last_week
`;

const NEXT_UP_SQL = `
  SELECT a.id, a.starts_at, a.status, c.id AS client_id, c.first_name, c.last_name
  FROM appointments a
  JOIN clients c ON c.id = a.client_id
  WHERE a.starts_at >= now()
    AND a.starts_at < (date_trunc('day', now() AT TIME ZONE $2) + interval '1 day') AT TIME ZONE $2
    AND a.status <> 'cancelled'
    AND ($1::uuid IS NULL OR a.practitioner_id = $1)
  ORDER BY a.starts_at
  LIMIT 5
`;

// Eight weeks of session volume. appointments is small (hundreds of rows), so
// this is a trivial extra read — it's here rather than in analytics.ts because
// it's a practice number and this is where practice numbers live.
const WEEKLY_SQL = `
  SELECT to_char(date_trunc('week', a.starts_at AT TIME ZONE $2), 'YYYY-MM-DD') AS wk, count(*)::int AS n
  FROM appointments a
  WHERE a.starts_at >= ((date_trunc('week', now() AT TIME ZONE $2) - interval '7 weeks') AT TIME ZONE $2)
    AND a.starts_at < ((date_trunc('week', now() AT TIME ZONE $2) + interval '1 week') AT TIME ZONE $2)
    AND a.status IN ('completed','confirmed','scheduled')
    AND ($1::uuid IS NULL OR a.practitioner_id = $1)
  GROUP BY wk ORDER BY wk
`;

/** Fill the empty weeks: a gap in the data is a zero, not a missing point. */
function toWeekly(rows: Array<{ wk: string; n: number }>): Array<{ label: string; count: number }> {
  const byWeek = new Map(rows.map((r) => [r.wk.slice(0, 10), Number(r.n)]));
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() - (7 - i) * 7 + 7);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), count: byWeek.get(key) ?? 0 };
  });
}

/** Photon orders still routing to a pharmacy. Photon is a network hop, so a
 *  slow or down sandbox degrades this ONE number to "—" instead of taking the
 *  dashboard with it. Both list calls are already memoized 60s in lib/photon. */
async function rxRoutingCount(): Promise<number | null> {
  if (!hasPhoton) return null;
  try {
    const orders = await listAllPhotonOrders();
    return orders.filter((o) => o.state === "ROUTING").length;
  } catch {
    return null;
  }
}

export async function practiceSnapshot(user: { id: string; role: Role }): Promise<PracticeSnapshot> {
  const scope: "all" | "own" = user.role === "admin" ? "all" : "own";
  const pid = scope === "all" ? null : user.id;

  if (!hasDb) return mockSnapshot(scope, pid);

  const [rows, nextRows, weeklyRows, rxRouting] = await Promise.all([
    sql.query(SNAPSHOT_SQL, [pid, PRACTICE_TZ]) as Promise<Array<Record<string, number>>>,
    sql.query(NEXT_UP_SQL, [pid, PRACTICE_TZ]) as unknown as Promise<
      Array<{ id: string; starts_at: string | Date; status: string; client_id: string; first_name: string; last_name: string }>
    >,
    sql.query(WEEKLY_SQL, [pid, PRACTICE_TZ]) as unknown as Promise<Array<{ wk: string; n: number }>>,
    rxRoutingCount(),
  ]);

  const r = rows[0] ?? {};
  return {
    scope,
    todayTotal: Number(r.today_total ?? 0),
    todayRemaining: Number(r.today_remaining ?? 0),
    nextUp: nextRows.map((n) => ({
      id: n.id,
      clientId: n.client_id,
      clientName: `${n.first_name} ${n.last_name}`,
      startsAt: isoDateTime(n.starts_at),
      status: n.status,
    })),
    activeClients: Number(r.active_clients ?? 0),
    unreadThreads: Number(r.unread_threads ?? 0),
    outstandingCents: Number(r.outstanding_cents ?? 0),
    overdueCount: Number(r.overdue_count ?? 0),
    overdueCents: Number(r.overdue_cents ?? 0),
    sessionsThisWeek: Number(r.sessions_this_week ?? 0),
    sessionsLastWeek: Number(r.sessions_last_week ?? 0),
    weeklySessions: toWeekly(weeklyRows),
    rxRouting,
  };
}

/** Photon inventory for the observatory. null when Photon isn't configured. */
export async function photonInventory(): Promise<{ prescriptions: number; orders: number; routing: number } | null> {
  if (!hasPhoton) return null;
  try {
    const [rx, orders] = await Promise.all([listAllPhotonPrescriptions(), listAllPhotonOrders()]);
    return { prescriptions: rx.length, orders: orders.length, routing: orders.filter((o) => o.state === "ROUTING").length };
  } catch {
    return null;
  }
}

// ── mock mode ─────────────────────────────────────────────────────────────────

function mockSnapshot(scope: "all" | "own", pid: string | null): PracticeSnapshot {
  const store = mockStore();
  const mine = <T extends { primaryPractitionerId?: string | null }>(rows: T[]) =>
    pid ? rows.filter((r) => r.primaryPractitionerId === pid) : rows;

  const clients = mine([...store.clients.values()]);
  const clientIds = new Set(clients.map((c) => c.id));
  const inScope = (clientId: string) => !pid || clientIds.has(clientId);

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  // Monday-start week, to match Postgres date_trunc('week').
  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const appts = [...store.appointments.values()].filter(
    (a) => (!pid || a.practitionerId === pid) && a.status !== "cancelled",
  );
  const at = (a: { startsAt: string }) => new Date(a.startsAt);
  const counted = ["completed", "confirmed", "scheduled"];

  const today = appts.filter((a) => at(a) >= dayStart && at(a) < dayEnd);
  const upcoming = today.filter((a) => at(a) >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const invoices = [...store.invoices.values()].filter((i) => inScope(i.clientId));
  const payments = [...store.payments.values()];
  const owed = (i: { id: string; totalCents: number }) =>
    i.totalCents - payments.filter((p) => p.invoiceId === i.id).reduce((s, p) => s + p.amountCents, 0);

  const threads = [...store.threads.values()].filter((t) => t.status === "open" && inScope(t.clientId));
  const messages = [...store.messages.values()];

  return {
    scope,
    todayTotal: today.length,
    todayRemaining: upcoming.length,
    nextUp: upcoming.slice(0, 5).map((a) => {
      const c = store.clients.get(a.clientId);
      return {
        id: a.id,
        clientId: a.clientId,
        clientName: c ? `${c.firstName} ${c.lastName}` : "Client",
        startsAt: a.startsAt,
        status: a.status,
      };
    }),
    activeClients: clients.filter((c) => c.status === "active").length,
    unreadThreads: threads.filter((t) => {
      const clientUserId = store.clients.get(t.clientId)?.userId ?? null;
      return messages.some((m) => m.threadId === t.id && !m.readAt && m.senderId === clientUserId);
    }).length,
    outstandingCents: invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + owed(i), 0),
    overdueCount: invoices.filter((i) => i.status === "overdue").length,
    overdueCents: invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + owed(i), 0),
    sessionsThisWeek: appts.filter((a) => at(a) >= weekStart && at(a) < now && counted.includes(a.status)).length,
    sessionsLastWeek: appts.filter((a) => at(a) >= prevWeekStart && at(a) < weekStart && counted.includes(a.status)).length,
    weeklySessions: Array.from({ length: 8 }, (_, i) => {
      const from = new Date(weekStart);
      from.setDate(from.getDate() - (7 - i) * 7);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      return {
        label: from.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count: appts.filter((a) => at(a) >= from && at(a) < to && counted.includes(a.status)).length,
      };
    }),
    rxRouting: null,
  };
}

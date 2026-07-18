import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";

// Notifications (sql/038) — the bell. Rows are per-user; producers so far are
// the data pipelines (kind 'sync_failure', written for every admin). Without
// a database the bell simply stays empty — demo mode has no pipelines to
// break.

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function listNotifications(userId: string, limit = 12): Promise<Notification[]> {
  if (!hasDb) return [];
  const rows = (await sql`
    SELECT id, kind, title, body, href, read_at, created_at
    FROM notifications WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT ${limit}
  `) as Array<{
    id: string;
    kind: string;
    title: string;
    body: string | null;
    href: string | null;
    read_at: Date | null;
    created_at: Date;
  }>;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    href: r.href,
    readAt: isoDateTime(r.read_at),
    createdAt: isoDateTime(r.created_at),
  }));
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  if (!hasDb) return 0;
  const [{ n }] = (await sql`
    SELECT count(*)::int AS n FROM notifications WHERE user_id = ${userId} AND read_at IS NULL
  `) as Array<{ n: number }>;
  return n;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!hasDb) return;
  await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${userId} AND read_at IS NULL`;
}

/** Fan a system notification out to every admin — pipeline alerts land with
 *  whoever can act on them. Fire-and-forget semantics belong to the caller. */
export async function notifyAdmins(opts: {
  kind: string;
  title: string;
  body?: string;
  href?: string;
}): Promise<void> {
  if (!hasDb) return;
  await sql`
    INSERT INTO notifications (user_id, kind, title, body, href)
    SELECT id, ${opts.kind}, ${opts.title}, ${opts.body ?? null}, ${opts.href ?? "/insights"}
    FROM users WHERE role = 'admin'
  `;
}

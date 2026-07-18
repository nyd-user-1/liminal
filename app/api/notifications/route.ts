import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { listNotifications, markAllNotificationsRead, unreadNotificationCount } from "@/lib/repos/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The bell's API — GET the current user's recent notifications + unread
// count, POST marks them all read (opening the menu is the read event; there
// is deliberately no per-row read state in v1). Own rows only; no PHI.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

export async function GET() {
  try {
    const user = await requireUser();
    const [notifications, unread] = await Promise.all([
      listNotifications(user.id),
      unreadNotificationCount(user.id),
    ]);
    return NextResponse.json({ notifications, unread });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

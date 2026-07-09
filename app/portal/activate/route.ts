import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { logEvent } from "@/lib/audit";
import { SESSION_COOKIE } from "@/lib/auth";
import { hasDb, sql } from "@/lib/db";
import { mockStore } from "@/lib/mock";

export const dynamic = "force-dynamic";

// Magic-link portal activation — the link emailed right after a self-service
// booking (see app/api/book/route.ts). The token is a real `sessions` row
// created at booking time via the same createSession() cookie-auth already
// reads; clicking the link just moves that token from email into the
// browser's session cookie. No password is ever set at this step.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const url = req.nextUrl.clone();
  url.search = "";

  let userId: string | null = null;
  let expiresAt: Date | null = null;

  if (token) {
    if (hasDb) {
      const rows = (await sql`
        SELECT s.user_id, s.expires_at FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ${token} AND s.expires_at > now() AND u.role = 'client' AND u.deleted_at IS NULL
      `) as Array<{ user_id: string; expires_at: string | Date }>;
      if (rows[0]) {
        userId = rows[0].user_id;
        expiresAt = new Date(rows[0].expires_at);
      }
    } else {
      const session = mockStore().sessions.get(token);
      const user = session ? mockStore().users.get(session.userId) : undefined;
      if (session && user && user.role === "client" && !user.deletedAt && new Date(session.expiresAt) > new Date()) {
        userId = session.userId;
        expiresAt = new Date(session.expiresAt);
      }
    }
  }

  if (!userId || !expiresAt) {
    url.pathname = "/sign-in";
    url.searchParams.set("error", "expired-link");
    return NextResponse.redirect(url);
  }

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  await logEvent({ actorId: userId, action: "auth.activate", entity: "user", entityId: userId });

  url.pathname = "/portal";
  return NextResponse.redirect(url);
}

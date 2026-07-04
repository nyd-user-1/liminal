import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { destroySession, getUser, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const user = await getUser();
    await destroySession(token);
    if (user) await logEvent({ actorId: user.id, action: "auth.logout", entity: "user", entityId: user.id });
  }
  jar.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}

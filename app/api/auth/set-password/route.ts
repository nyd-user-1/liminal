import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { consumePasswordToken, createSession, SESSION_COOKIE, setUserPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Redeem a one-time set/reset link: set the password and sign the user in. */
export async function POST(req: Request) {
  let body: { token?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token) return NextResponse.json({ error: "This link is invalid." }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const userId = await consumePasswordToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: "This link has expired or was already used. Request a new one from the sign-in page." },
      { status: 400 },
    );
  }

  await setUserPassword(userId, password);
  const { token: session, absoluteExpiresAt } = await createSession(userId);
  (await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: absoluteExpiresAt,
  });

  await logEvent({ actorId: userId, action: "auth.set_password", entity: "user", entityId: userId });
  return NextResponse.json({ ok: true });
}

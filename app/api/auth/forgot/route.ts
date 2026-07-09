import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { createPasswordToken, findUserByEmail } from "@/lib/auth";
import { appBaseUrl, sendPasswordEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Request a reset link. Always returns ok — never reveals whether an account exists. */
export async function POST(req: Request) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  const user = await findUserByEmail(email);
  if (user) {
    const token = await createPasswordToken(user.id, "reset");
    await sendPasswordEmail({
      to: user.email,
      firstName: user.name.split(" ")[0] ?? user.name,
      url: `${appBaseUrl()}/set-password?token=${token}`,
      purpose: "reset",
    });
    await logEvent({ actorId: null, action: "auth.reset_request", entity: "user", entityId: user.id });
  }
  return NextResponse.json({ ok: true });
}

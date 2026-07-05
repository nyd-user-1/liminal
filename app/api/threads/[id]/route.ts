import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRole, requireUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { clientForUser, getThread, markRead, setThreadStatus } from "@/lib/repos/threads";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** Thread + messages. Reading marks the other party's messages as read. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await getThread(id);
    if (!detail) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (user.role === "client") {
      const client = await clientForUser(user.id);
      if (!client || detail.thread.clientId !== client.id) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
    }
    await markRead(id, user.id);
    await logEvent({ actorId: user.id, action: "thread.view", entity: "thread", entityId: id });
    return NextResponse.json(detail);
  } catch (e) {
    return fail(e);
  }
}

/** Close / reopen a thread (practitioner). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const { status } = (await req.json()) as { status?: string };
    if (status !== "open" && status !== "closed") {
      return NextResponse.json({ error: "status must be open or closed." }, { status: 400 });
    }
    const thread = await setThreadStatus(id, status);
    if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });
    await logEvent({ actorId: user.id, action: `thread.${status === "closed" ? "close" : "reopen"}`, entity: "thread", entityId: id });
    return NextResponse.json(thread);
  } catch (e) {
    return fail(e);
  }
}

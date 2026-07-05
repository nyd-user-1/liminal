import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { clientForUser, createThread, listThreads } from "@/lib/repos/threads";
import type { ThreadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** List threads — practitioners see all; clients only their own. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const status = (req.nextUrl.searchParams.get("status") as ThreadStatus | null) ?? undefined;
    if (user.role === "client") {
      const client = await clientForUser(user.id);
      if (!client) return NextResponse.json([]);
      return NextResponse.json(await listThreads({ clientId: client.id, status }));
    }
    const clientId = req.nextUrl.searchParams.get("clientId") ?? undefined;
    return NextResponse.json(await listThreads({ clientId, status }));
  } catch (e) {
    return fail(e);
  }
}

/** Create a thread (+ first message). Clients are locked to their own record. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { clientId, subject, body } = (await req.json()) as {
      clientId?: string;
      subject?: string;
      body?: string;
    };
    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });
    }
    let targetClientId = clientId;
    if (user.role === "client") {
      const client = await clientForUser(user.id);
      if (!client) return NextResponse.json({ error: "No client record for this login." }, { status: 403 });
      targetClientId = client.id;
    }
    if (!targetClientId) return NextResponse.json({ error: "clientId is required." }, { status: 400 });

    const thread = await createThread({
      clientId: targetClientId,
      subject: subject.trim(),
      senderId: user.id,
      body: body.trim(),
    });
    await logEvent({ actorId: user.id, action: "message.send", entity: "thread", entityId: thread.id });
    return NextResponse.json(thread, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

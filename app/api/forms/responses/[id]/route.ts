import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getResponse, saveResponseProgress } from "@/lib/repos/forms";
import { clientForUser } from "@/lib/repos/threads";
import type { SessionUser } from "@/lib/auth";
import type { FormResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** Clients may only touch responses that belong to their own client record. */
async function canAccess(user: SessionUser, response: FormResponse): Promise<boolean> {
  if (user.role !== "client") return true;
  const client = await clientForUser(user.id);
  return !!client && response.clientId === client.id;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const response = await getResponse(id);
    if (!response || !(await canAccess(user, response))) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await logEvent({ actorId: user.id, action: "form_response.view", entity: "form_response", entityId: id });
    return NextResponse.json(response);
  } catch (e) {
    return fail(e);
  }
}

/** Save progress (portal wizard) — answers persist, status → in_progress. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const response = await getResponse(id);
    if (!response || !(await canAccess(user, response))) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (response.status === "submitted") {
      return NextResponse.json({ error: "This form was already submitted." }, { status: 400 });
    }
    const { answers } = (await req.json()) as { answers?: Record<string, unknown> };
    const next = await saveResponseProgress(id, answers ?? {});
    return NextResponse.json(next);
  } catch (e) {
    return fail(e);
  }
}

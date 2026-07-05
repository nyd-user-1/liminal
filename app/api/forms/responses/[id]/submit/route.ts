import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getForm, getResponse, submitResponse } from "@/lib/repos/forms";
import { clientForUser } from "@/lib/repos/threads";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** Final submission — validates required blocks, persists, notifies. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const response = await getResponse(id);
    if (!response) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (user.role === "client") {
      const client = await clientForUser(user.id);
      if (!client || response.clientId !== client.id) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
    }
    if (response.status === "submitted") {
      return NextResponse.json({ error: "This form was already submitted." }, { status: 400 });
    }
    const { answers } = (await req.json()) as { answers?: Record<string, unknown> };
    const form = await getForm(response.formId);
    const missing = (form?.schema ?? []).filter((b) => {
      if (!b.required || b.type === "info") return false;
      const v = (answers ?? {})[b.id];
      return v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0);
    });
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required answers: ${missing.map((b) => b.label).join("; ")}` }, { status: 400 });
    }
    const next = await submitResponse(id, answers ?? {});
    await logEvent({
      actorId: user.id,
      action: "form.submit",
      entity: "form_response",
      entityId: id,
      meta: { form: form?.title ?? null },
    });
    return NextResponse.json(next);
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getForm, sendForm } from "@/lib/repos/forms";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** Send a form to a client → form_response (sent) + portal-link message. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const form = await getForm(id);
    if (!form) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (form.status !== "published") {
      return NextResponse.json({ error: "Publish the form before sending it." }, { status: 400 });
    }
    const { clientId } = (await req.json()) as { clientId?: string };
    if (!clientId) return NextResponse.json({ error: "clientId is required." }, { status: 400 });
    const response = await sendForm(id, clientId, user.id);
    await logEvent({ actorId: user.id, action: "form.send", entity: "form_response", entityId: response.id, meta: { form: form.title } });
    return NextResponse.json(response, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

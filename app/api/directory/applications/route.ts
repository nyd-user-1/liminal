import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { createProviderApplication, listProviderApplications } from "@/lib/repos/directory";

export const dynamic = "force-dynamic";

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/** POST /api/directory/applications — public "Join as a provider" submission. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }
  const app = await createProviderApplication({
    name,
    email,
    phone: body?.phone?.trim() || null,
    licenseType: body?.licenseType?.trim() || null,
    state: body?.state?.trim() || null,
    npi: body?.npi?.trim() || null,
    message: body?.message?.trim() || null,
  });
  await logEvent({ actorId: null, action: "provider_application.create", entity: "provider_application", entityId: app.id });
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** GET /api/directory/applications — staff review list. */
export async function GET() {
  try {
    await requireRole("practitioner");
    const applications = await listProviderApplications();
    return NextResponse.json({ applications });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

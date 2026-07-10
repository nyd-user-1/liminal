import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { createProviderLead, getProvider, listProviderLeads } from "@/lib/repos/directory";

export const dynamic = "force-dynamic";

// Public "request an appointment" lead capture for off-platform directory
// providers (the /providers/[slug] booking rail). POST is anonymous; the
// list view is staff-only.

function fail(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const providerId = s("providerId");
  const name = s("name");
  const email = s("email").toLowerCase();
  if (!providerId || !name) {
    return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  try {
    const provider = await getProvider(providerId);
    if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });

    const lead = await createProviderLead({
      providerId,
      name,
      email,
      phone: s("phone") || null,
      payer: s("payer") || null,
      note: s("note").slice(0, 1000) || null,
    });
    await logEvent({ actorId: null, action: "lead.create", entity: "provider_lead", entityId: lead.id, meta: { providerId } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

/** GET ?providerId= — staff view of appointment requests. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const providerId = req.nextUrl.searchParams.get("providerId") ?? undefined;
    return NextResponse.json({ leads: await listProviderLeads({ providerId }) });
  } catch (e) {
    return fail(e);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { createClient, listClients } from "@/lib/repos/clients";
import type { ClientStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: ClientStatus[] = ["lead", "active", "archived"];

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/** GET /api/clients?q=&status=&tag= — client index (PHI read, audited). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    const p = req.nextUrl.searchParams;
    const status = p.get("status");
    const clients = await listClients({
      q: p.get("q") ?? undefined,
      status: status && STATUSES.includes(status as ClientStatus) ? (status as ClientStatus) : undefined,
      tag: p.get("tag") ?? undefined,
    });
    await logEvent({ actorId: user.id, action: "client.list", entity: "client", meta: { count: clients.length } });
    return NextResponse.json({ clients });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

/** POST /api/clients — create a client. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    const body = await req.json().catch(() => null);
    const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
    }
    const status = STATUSES.includes(body?.status) ? (body.status as ClientStatus) : undefined;
    const client = await createClient({
      firstName,
      lastName,
      dob: body?.dob || null,
      email: body?.email?.trim() || null,
      phone: body?.phone?.trim() || null,
      address: body?.address?.trim() || null,
      gender: body?.gender || null,
      pronouns: body?.pronouns?.trim() || null,
      status,
      tags: Array.isArray(body?.tags) ? body.tags.filter((t: unknown) => typeof t === "string" && t) : [],
      primaryPractitionerId: body?.primaryPractitionerId || null,
    });
    await logEvent({ actorId: user.id, action: "client.create", entity: "client", entityId: client.id });
    return NextResponse.json({ client }, { status: 201 });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

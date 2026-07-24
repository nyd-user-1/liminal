import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { createSchemaDraft, listSchemaDrafts } from "@/lib/repos/schema-drafts";
import { validSchemaDraftDoc } from "@/lib/schema-draft";

export const dynamic = "force-dynamic";

// Saved schema-redesign drafts — owner-scoped CRUD, admin-only (same gate as
// the Data dictionary page). Catalog metadata only, no PHI — no logEvent.

/** GET /api/schema-drafts — the caller's saved drafts, newest first. */
export async function GET() {
  try {
    const user = await requireRole("admin");
    return NextResponse.json({ drafts: await listSchemaDrafts(user.id) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("schema-drafts list", e);
    return NextResponse.json({ error: "Couldn't load drafts." }, { status: 500 });
  }
}

/** POST /api/schema-drafts { name, doc } → created meta. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("admin");
    const body = (await req.json()) as { name?: string; doc?: unknown };
    const name = (body.name ?? "").trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "Name the draft before saving." }, { status: 400 });
    if (!validSchemaDraftDoc(body.doc)) return NextResponse.json({ error: "Malformed draft document." }, { status: 400 });
    return NextResponse.json({ draft: await createSchemaDraft(user.id, name, body.doc) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("schema-drafts create", e);
    return NextResponse.json({ error: "Couldn't save the draft." }, { status: 500 });
  }
}

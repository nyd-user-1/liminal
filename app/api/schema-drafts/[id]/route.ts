import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { deleteSchemaDraft, getSchemaDraft, updateSchemaDraft } from "@/lib/repos/schema-drafts";
import { validSchemaDraftDoc } from "@/lib/schema-draft";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/schema-drafts/[id] → { meta, doc } (owner only). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("admin");
    const { id } = await params;
    const draft = await getSchemaDraft(user.id, id);
    if (!draft) return NextResponse.json({ error: "Unknown draft." }, { status: 404 });
    return NextResponse.json(draft);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("schema-drafts get", e);
    return NextResponse.json({ error: "Couldn't load the draft." }, { status: 500 });
  }
}

/** PUT /api/schema-drafts/[id] { name?, doc? } — partial update (owner only). */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("admin");
    const { id } = await params;
    const body = (await req.json()) as { name?: string; doc?: unknown };
    const name = body.name === undefined ? undefined : (body.name ?? "").trim().slice(0, 120) || undefined;
    if (body.doc !== undefined && !validSchemaDraftDoc(body.doc)) {
      return NextResponse.json({ error: "Malformed draft document." }, { status: 400 });
    }
    const ok = await updateSchemaDraft(user.id, id, { name, doc: body.doc === undefined ? undefined : body.doc });
    if (!ok) return NextResponse.json({ error: "Unknown draft." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("schema-drafts update", e);
    return NextResponse.json({ error: "Couldn't save the draft." }, { status: 500 });
  }
}

/** DELETE /api/schema-drafts/[id] (owner only). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("admin");
    const { id } = await params;
    const ok = await deleteSchemaDraft(user.id, id);
    if (!ok) return NextResponse.json({ error: "Unknown draft." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("schema-drafts delete", e);
    return NextResponse.json({ error: "Couldn't delete the draft." }, { status: 500 });
  }
}

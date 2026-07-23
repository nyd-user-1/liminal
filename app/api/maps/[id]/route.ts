import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { deleteMap, getMap, updateMap } from "@/lib/repos/canvas";
import { validCanvasDoc } from "@/lib/canvas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/maps/[id] → { meta, doc } (owner only). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const map = await getMap(user.id, id);
    if (!map) return NextResponse.json({ error: "Unknown map." }, { status: 404 });
    return NextResponse.json(map);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("maps get", e);
    return NextResponse.json({ error: "Couldn't load the map." }, { status: 500 });
  }
}

/** PUT /api/maps/[id] { name?, doc? } — partial update (owner only). */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const body = (await req.json()) as { name?: string; doc?: unknown };
    const name = body.name === undefined ? undefined : (body.name ?? "").trim().slice(0, 120) || undefined;
    if (body.doc !== undefined && !validCanvasDoc(body.doc)) {
      return NextResponse.json({ error: "Malformed map document." }, { status: 400 });
    }
    const ok = await updateMap(user.id, id, { name, doc: body.doc === undefined ? undefined : body.doc });
    if (!ok) return NextResponse.json({ error: "Unknown map." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("maps update", e);
    return NextResponse.json({ error: "Couldn't save the map." }, { status: 500 });
  }
}

/** DELETE /api/maps/[id] (owner only). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const ok = await deleteMap(user.id, id);
    if (!ok) return NextResponse.json({ error: "Unknown map." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("maps delete", e);
    return NextResponse.json({ error: "Couldn't delete the map." }, { status: 500 });
  }
}

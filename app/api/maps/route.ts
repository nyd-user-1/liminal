import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { createMap, listMaps } from "@/lib/repos/canvas";
import { validCanvasDoc } from "@/lib/canvas";

export const dynamic = "force-dynamic";

// Saved /maps documents — owner-scoped CRUD. Reference entities only (TINs,
// payer names, NPIs) — no PHI, so no logEvent (the /api/orgs/graph rule).

/** GET /api/maps — the caller's saved maps, newest first. */
export async function GET() {
  try {
    const user = await requireRole("practitioner");
    return NextResponse.json({ maps: await listMaps(user.id) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("maps list", e);
    return NextResponse.json({ error: "Couldn't load maps." }, { status: 500 });
  }
}

/** POST /api/maps { name, doc } → created meta. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    const body = (await req.json()) as { name?: string; doc?: unknown };
    const name = (body.name ?? "").trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "Name the map before saving." }, { status: 400 });
    if (!validCanvasDoc(body.doc)) return NextResponse.json({ error: "Malformed map document." }, { status: 400 });
    return NextResponse.json({ map: await createMap(user.id, name, body.doc) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("maps create", e);
    return NextResponse.json({ error: "Couldn't save the map." }, { status: 500 });
  }
}

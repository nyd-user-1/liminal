import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { hydrateCanvasEdges } from "@/lib/repos/canvas";

export const dynamic = "force-dynamic";

// Edge hydration for the /maps builder: given the bound entities on a canvas,
// return every relationship the rate corpus attests among them. POST because
// the ref lists don't fit a query string; still a pure read.

const cap = (v: unknown, n: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 200).slice(0, n) : [];

/** POST /api/maps/edges { orgs?, payers?, providers? } → CanvasEdges */
export async function POST(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const body = (await req.json()) as { orgs?: unknown; payers?: unknown; providers?: unknown };
    const edges = await hydrateCanvasEdges({
      orgs: cap(body.orgs, 40),
      payers: cap(body.payers, 40),
      providers: cap(body.providers, 40),
    });
    return NextResponse.json(edges);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("maps edges", e);
    return NextResponse.json({ error: "Edge lookup failed." }, { status: 500 });
  }
}

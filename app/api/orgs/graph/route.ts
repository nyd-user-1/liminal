import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getOrgGraph } from "@/lib/repos/org-graph";

export const dynamic = "force-dynamic";

// Relationship graph for one org — the /orgs Map tab fetches this lazily on
// first view (same pattern as /api/orgs/participation). Public-record data, no
// logEvent. The /chat relationship_map tool will read the same repo fn.

/** GET /api/orgs/graph?tin=ein:832675429 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const tin = (req.nextUrl.searchParams.get("tin") ?? "").trim();
    if (!tin) return NextResponse.json({ error: "Provide a TIN." }, { status: 400 });
    const graph = await getOrgGraph(tin);
    if (!graph) return NextResponse.json({ error: "Unknown organization." }, { status: 404 });
    return NextResponse.json(graph);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("orgs/graph", e);
    return NextResponse.json({ error: "Graph lookup failed." }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getPayerGraph } from "@/lib/repos/org-graph";

export const dynamic = "force-dynamic";

// Pivot-on-node for the org map: one insurer re-rooted to the biggest
// organizations in its book. Public MRF data, no logEvent.

/** GET /api/orgs/payer-graph?payer=Aetna%20Life%20Insurance%20Company */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const payer = (req.nextUrl.searchParams.get("payer") ?? "").trim();
    if (!payer) return NextResponse.json({ error: "Provide a payer." }, { status: 400 });
    const graph = await getPayerGraph(payer);
    if (!graph) return NextResponse.json({ error: "No rate book for that plan." }, { status: 404 });
    return NextResponse.json(graph);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("orgs/payer-graph", e);
    return NextResponse.json({ error: "Pivot lookup failed." }, { status: 500 });
  }
}

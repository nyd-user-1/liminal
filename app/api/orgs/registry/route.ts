import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { listOrganizations, type OrganizationFilter } from "@/lib/repos/orgs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILTERS = new Set<OrganizationFilter>(["ny", "platform", "tin", "deactivated"]);

/** GET /api/orgs/registry?q=&filters=ny,tin — server-side search over the
 *  NPI-2 registry (sql/034). No PHI: NPPES public data only. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const filters = (req.nextUrl.searchParams.get("filters") ?? "")
      .split(",")
      .filter((f): f is OrganizationFilter => FILTERS.has(f as OrganizationFilter));
    const result = await listOrganizations({ q, filters });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
}

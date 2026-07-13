import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { searchProviders } from "@/lib/repos/directory";
import { networkSummariesByNpi } from "@/lib/repos/networks";
import { rateSummariesByNpi } from "@/lib/repos/rate-directory";

export const dynamic = "force-dynamic";

/** GET /api/directory/providers?q=&zip=&county=&profession=&subspecialty=&gender=&type=&page= */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const p = req.nextUrl.searchParams;
    // sort=accepting:desc | network:asc — global server-side sort over the
    // participation aggregate (client sort only reorders loaded pages).
    const [sortCol, sortDir] = (p.get("sort") ?? "").split(":");
    const page = await searchProviders({
      q: p.get("q") ?? undefined,
      zip: p.get("zip") ?? undefined,
      city: p.get("city") ?? undefined,
      county: p.get("county") ?? undefined,
      profession: p.get("profession") ?? undefined,
      subspecialty: p.get("subspecialty") ?? undefined,
      gender: p.get("gender") ?? undefined,
      providerType: p.get("type") ?? undefined, // therapist | psychiatrist | prescriber
      sort: sortCol === "accepting" || sortCol === "network" ? sortCol : undefined,
      sortDir: sortDir === "asc" ? "asc" : "desc",
      page: Number(p.get("page")) || 1,
    });
    // Batch the payer-network summary + best-rate summary for just this page's
    // NPIs (absent = no data, which the UI renders as nothing — absence is
    // NOT out-of-network).
    const npis = page.items.map((i) => i.npi);
    const [networks, rates] = await Promise.all([networkSummariesByNpi(npis), rateSummariesByNpi(npis)]);
    return NextResponse.json({ ...page, networks: Object.fromEntries(networks), rates: Object.fromEntries(rates) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

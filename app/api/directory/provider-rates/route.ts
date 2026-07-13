import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { listNetworkMemberships, listProviderRates } from "@/lib/repos/rate-directory";

export const dynamic = "force-dynamic";

// Compact per-NPI rate rows for the provider profile's Overview table.
// Payer-published public-record data (TiC MRFs), not PHI — no logEvent
// (mirrors the /api/rates convention). Deliberately skips the standing
// endpoint's TIN-cohort/economics work, which made this table slow.

/** GET /api/directory/provider-rates?npi=1234567890 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const npi = (req.nextUrl.searchParams.get("npi") ?? "").trim();
    if (!/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: "Provide a 10-digit NPI." }, { status: 400 });
    }
    const rates = await listProviderRates(npi);
    const memberships = await listNetworkMemberships(npi, rates);
    return NextResponse.json({ rates, memberships });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("provider-rates", e);
    return NextResponse.json({ error: "Rate lookup failed." }, { status: 500 });
  }
}

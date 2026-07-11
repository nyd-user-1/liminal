import { NextResponse } from "next/server";
import { listPayerFacets } from "@/lib/repos/networks";

export const dynamic = "force-dynamic";

// Real, harvested insurance payers only (no demo/filler carriers) — for the
// nav Search panel's insurance filter rail, a lightweight client-fetchable
// read of the same listPayerFacets() the /providers insurance dropdown uses
// (see lib/insurance-options.ts for the full list including uncovered
// carriers, which needs a server component and isn't fetchable from a "use
// client" nav). Sorted by provider_count DESC already, biggest payers first.
export async function GET() {
  const facets = await listPayerFacets();
  return NextResponse.json({
    payers: facets.map((f) => ({ slug: f.slug, name: f.name, providerCount: f.providerCount })),
  });
}

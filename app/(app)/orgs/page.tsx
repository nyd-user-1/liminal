import { requireRole } from "@/lib/auth";
import { listOrgs, orgFacets } from "@/lib/repos/orgs";
import { OrgsIndex } from "./orgs-index";

// Organizations — the billing-TIN entity between providers and payers
// (Headway NY, platform groups, hospital faculty practices). One row = one
// contract-holding TIN observed across the MRF rate files; open one to see
// its roster, per-insurer rate economics, and network participation (NYS-41).
// Server component seeds the first page + payer facet; the tab/search/filters
// re-query via /api/orgs.

export const dynamic = "force-dynamic";

export default async function OrgsPage() {
  await requireRole("practitioner");
  const [orgs, facets] = await Promise.all([listOrgs({ limit: 50 }), orgFacets()]);
  return <OrgsIndex initial={orgs} payerOptions={facets.payers} />;
}

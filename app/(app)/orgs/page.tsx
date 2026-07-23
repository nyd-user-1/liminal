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

export default async function OrgsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole("practitioner");
  // ?q= seeds the search (deep links from an org rail's Related list).
  const { q } = await searchParams;
  const [orgs, facets] = await Promise.all([listOrgs({ q, limit: 50 }), orgFacets()]);
  return <OrgsIndex initial={orgs.rows} initialTotal={orgs.total} initialQ={q} payerOptions={facets.payers} />;
}

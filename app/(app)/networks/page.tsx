import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listNetworks, networkOrgCounts, orgNetworkRatesSummary } from "@/lib/repos/networks";
import { NetworksIndex } from "./networks-index";

// /networks — the canonical-network index (sql/044, NYS-49). The reference
// surface for the NYS-147/148 template (identity card + stacked full-feature
// DataTable). H1 is route-derived in the TopBar (ROUTE_TITLES → "Networks").
// Orgs-priced counts + the aggregate-card rollup read org_network_rates
// (sql/048); the anchor code is 90837.

export const dynamic = "force-dynamic";

export default async function NetworksPage() {
  const user = await requireUser();
  if (user.role === "client") redirect("/portal");
  const [networks, orgCounts, summary] = await Promise.all([
    listNetworks(),
    networkOrgCounts("90837"),
    orgNetworkRatesSummary(),
  ]);
  return <NetworksIndex initial={networks} orgsPriced={Object.fromEntries(orgCounts)} summary={summary} />;
}

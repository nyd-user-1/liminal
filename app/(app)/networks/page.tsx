import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listNetworks, networkOrgCounts } from "@/lib/repos/networks";
import { NetworksIndex } from "./networks-index";

// /networks — the canonical-network index (sql/044, NYS-49). The reference
// surface for the stacked full-feature DataTable (NYS-147). H1 is
// route-derived in the TopBar (ROUTE_TITLES → "Networks"). Orgs-priced counts
// read org_network_rates (sql/048) at the anchor code 90837.

export const dynamic = "force-dynamic";

export default async function NetworksPage() {
  const user = await requireUser();
  if (user.role === "client") redirect("/portal");
  const [networks, orgCounts] = await Promise.all([listNetworks(), networkOrgCounts("90837")]);
  return <NetworksIndex initial={networks} orgsPriced={Object.fromEntries(orgCounts)} />;
}

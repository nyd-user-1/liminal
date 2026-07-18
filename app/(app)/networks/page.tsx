import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listNetworks } from "@/lib/repos/networks";
import { NetworksIndex } from "./networks-index";

// /networks — the canonical-network index (sql/044, NYS-49). The reference
// surface for the stacked full-feature DataTable. H1 is route-derived in the
// TopBar (ROUTE_TITLES → "Networks").

export const dynamic = "force-dynamic";

export default async function NetworksPage() {
  const user = await requireUser();
  if (user.role === "client") redirect("/portal");
  const networks = await listNetworks();
  return <NetworksIndex initial={networks} />;
}

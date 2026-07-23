import { requireRole } from "@/lib/auth";
import { orgFacets } from "@/lib/repos/orgs";
import { listMaps } from "@/lib/repos/canvas";
import { MapsClient } from "./maps-client";

// /maps — build-your-own relationship maps over the rate corpus. Drag entity
// cards (organizations, insurers, providers) onto a canvas; the corpus draws
// every edge it can attest, with the org-map chip grammar. Documents save
// per user (canvas_maps). Reference data only — no PHI ever touches a map.

export const dynamic = "force-dynamic";

export default async function MapsPage() {
  const user = await requireRole("practitioner");
  const [facets, maps] = await Promise.all([orgFacets(), listMaps(user.id)]);
  return <MapsClient payers={facets.payers} initialMaps={maps} />;
}

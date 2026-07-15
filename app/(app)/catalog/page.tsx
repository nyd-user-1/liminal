import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth";
import { getPhotonCatalog, hasPhoton } from "@/lib/photon";
import { CatalogIndex } from "./catalog-index";

// Treatment catalog — the org's formulary, i.e. what the prescribe flow offers.
// Org configuration rather than PHI, so there's no per-caseload scoping here:
// every practitioner sees (and manages) the same one catalog.

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  await requireRole("practitioner");
  if (!hasPhoton) {
    return (
      <EmptyState
        icon="grid"
        title="Photon is not configured"
        subtext="Set the PHOTON_* environment variables to manage the treatment catalog."
      />
    );
  }

  const catalog = await getPhotonCatalog();
  if (!catalog) {
    return (
      <EmptyState
        icon="grid"
        title="No catalog"
        subtext="This Photon organisation has no treatment catalog yet."
      />
    );
  }

  return <CatalogIndex catalogName={catalog.name} treatments={catalog.treatments} />;
}

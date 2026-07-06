import { nycResourceCategories, searchNycResources } from "@/lib/repos/directory";
import { ResourcesList } from "./resources-list";

// Portal Resources — a calm, read-only directory of NYC mental-health programs
// (OMH data, five boroughs). No referral actions; just findable local care.

export const dynamic = "force-dynamic";

export default async function PortalResourcesPage() {
  const [initial, categories] = await Promise.all([searchNycResources({}), nycResourceCategories()]);
  return <ResourcesList initial={initial} categories={categories} />;
}

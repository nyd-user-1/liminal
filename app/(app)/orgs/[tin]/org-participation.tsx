import { getOrgParticipation } from "@/lib/repos/orgs";
import { OrgParticipationView } from "./org-participation-view";

// Network participation — independent evidence from payer FHIR directories:
// which of this org's clinicians a payer lists in which network, and how many
// are flagged accepting-new-patients. Membership corroborates the rate-file
// evidence; accepting is a liveness signal the rate files can't carry. Heavier
// query (joins live participation) → this async server component is streamed in
// via Suspense; it hands rows to the client view (Table carries hooks).

export { OrgParticipationFallback } from "./org-participation-view";

export async function OrgParticipation({ tin }: { tin: string }) {
  const rows = await getOrgParticipation(tin);
  return <OrgParticipationView rows={rows} />;
}

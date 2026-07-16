import { requireRole } from "@/lib/auth";
import { listOrganizations } from "@/lib/repos/orgs";
import { RegistryIndex } from "./registry-index";

// Organizations → NPI-2 registry — the LEGAL organizations enumerated in
// NPPES (sql/034; 105k rows: every NY org + the national platforms our
// datasets reference), beside the billing-TIN books at /orgs. The two join
// where an org's NPI is itself a published TIN (is_billing_tin).

export const dynamic = "force-dynamic";

export default async function OrgRegistryPage() {
  await requireRole("practitioner");
  const initial = await listOrganizations({});
  return <RegistryIndex initial={initial} />;
}

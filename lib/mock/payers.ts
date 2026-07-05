import { registerFixtures } from "@/lib/mock";
import type { InsurancePolicy, Payer, PolicyKind, PolicyStatus } from "@/lib/types";

// Payer fixtures — mirrors sql/002_seed.sql payers (12) + insurance_policies
// (13): same uuids/values. Policies are the Clients agent's domain, but the
// payers tab (policy counts) and the printable superbill need them; seeding
// here is idempotent — same fixed uuids, so if the clients feature also seeds
// them the Map.set calls are no-ops in effect.

const T = "2026-06-01T09:00:00.000Z";

const PAYER = (nn: string) => `00000000-0000-4000-8000-0000000120${nn}`;
const POLICY = (nn: string) => `00000000-0000-4000-8000-0000000130${nn}`;
const C = (nn: string) => `00000000-0000-4000-8000-0000000020${nn}`;

const payers: Payer[] = [
  { id: PAYER("01"), name: "Aetna", payerCode: "60054", createdAt: T, updatedAt: T },
  { id: PAYER("02"), name: "UnitedHealthcare", payerCode: "87726", createdAt: T, updatedAt: T },
  { id: PAYER("03"), name: "Cigna", payerCode: "62308", createdAt: T, updatedAt: T },
];

function policy(
  nn: string,
  clientNn: string,
  payerNn: string,
  memberId: string,
  groupId: string | null,
  kind: PolicyKind,
  status: PolicyStatus,
  copayCents: number | null,
): InsurancePolicy {
  return {
    id: POLICY(nn),
    clientId: C(clientNn),
    payerId: PAYER(payerNn),
    memberId,
    groupId,
    kind,
    status,
    copayCents,
    createdAt: T,
    updatedAt: T,
  };
}

const policies: InsurancePolicy[] = [
  policy("01", "01", "01", "W442918203", "GRP-88410", "primary", "verified", 2500),
  policy("02", "01", "03", "U01772345", null, "secondary", "unverified", null),
  policy("03", "02", "02", "918274655", "GRP-10275", "primary", "verified", 3000),
  policy("04", "03", "03", "U88320117", "GRP-55201", "primary", "unverified", null),
  policy("05", "04", "01", "W105583920", "GRP-88410", "primary", "verified", 2000),
  policy("06", "05", "02", "904415872", null, "primary", "unverified", 2500),
  policy("07", "06", "03", "U55418290", "GRP-31007", "primary", "inactive", null),
];

registerFixtures("payers", (store) => {
  for (const p of payers) store.payers.set(p.id, p);
  for (const p of policies) if (!store.insurancePolicies.has(p.id)) store.insurancePolicies.set(p.id, p);
});

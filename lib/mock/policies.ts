import { registerFixtures } from "@/lib/mock";
import type { InsurancePolicy, Payer, PolicyKind, PolicyStatus } from "@/lib/types";

// Mirrors sql/002_seed.sql — payers (12) + insurance_policies (13):
// same uuids, payer codes, member ids, statuses, copays.

const uuid = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
const T = "2026-06-01T09:00:00.000Z";

const payers: Payer[] = [
  { id: uuid("12001"), name: "Aetna", payerCode: "60054", createdAt: T, updatedAt: T },
  { id: uuid("12002"), name: "UnitedHealthcare", payerCode: "87726", createdAt: T, updatedAt: T },
  { id: uuid("12003"), name: "Cigna", payerCode: "62308", createdAt: T, updatedAt: T },
];

function policy(
  id: string,
  clientId: string,
  payerId: string,
  memberId: string,
  groupId: string | null,
  kind: PolicyKind,
  status: PolicyStatus,
  copayCents: number | null,
): InsurancePolicy {
  return {
    id: uuid(id),
    clientId: uuid(clientId),
    payerId: uuid(payerId),
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
  policy("13001", "2001", "12001", "W442918203", "GRP-88410", "primary", "verified", 2500),
  policy("13002", "2001", "12003", "U01772345", null, "secondary", "unverified", null),
  policy("13003", "2002", "12002", "918274655", "GRP-10275", "primary", "verified", 3000),
  policy("13004", "2003", "12003", "U88320117", "GRP-55201", "primary", "unverified", null),
  policy("13005", "2004", "12001", "W105583920", "GRP-88410", "primary", "verified", 2000),
  policy("13006", "2005", "12002", "904415872", null, "primary", "unverified", 2500),
  policy("13007", "2006", "12003", "U55418290", "GRP-31007", "primary", "inactive", null),
];

registerFixtures("policies", (store) => {
  for (const p of payers) store.payers.set(p.id, p);
  for (const p of policies) store.insurancePolicies.set(p.id, p);
});

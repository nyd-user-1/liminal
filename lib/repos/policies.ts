import { hasDb, sql } from "@/lib/db";
import { mockId, mockStore } from "@/lib/mock";
import "@/lib/mock/policies";
import type { InsurancePolicy, Payer, PolicyKind, PolicyStatus } from "@/lib/types";

// Insurance repo — payers + client policies. hasDb → Postgres; otherwise the
// in-memory mock store (fixtures mirror sql/002_seed.sql).

/** Policy joined with its payer's display fields. */
export interface PolicyWithPayer extends InsurancePolicy {
  payerName: string;
  payerCode: string;
}

type PolicyRow = {
  id: string;
  client_id: string;
  payer_id: string;
  member_id: string;
  group_id: string | null;
  kind: PolicyKind;
  status: PolicyStatus;
  copay_cents: number | null;
  created_at: string;
  updated_at: string;
};

function toPolicy(r: PolicyRow): InsurancePolicy {
  return {
    id: r.id,
    clientId: r.client_id,
    payerId: r.payer_id,
    memberId: r.member_id,
    groupId: r.group_id,
    kind: r.kind,
    status: r.status,
    copayCents: r.copay_cents,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listPayers(): Promise<Payer[]> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM payers ORDER BY name`) as Array<{
      id: string;
      name: string;
      payer_code: string;
      created_at: string;
      updated_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      payerCode: r.payer_code,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }
  return [...mockStore().payers.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listPolicies(clientId: string): Promise<PolicyWithPayer[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT ip.*, p.name AS payer_name, p.payer_code
      FROM insurance_policies ip JOIN payers p ON p.id = ip.payer_id
      WHERE ip.client_id = ${clientId}
      ORDER BY ip.kind, ip.created_at
    `) as Array<PolicyRow & { payer_name: string; payer_code: string }>;
    return rows.map((r) => ({ ...toPolicy(r), payerName: r.payer_name, payerCode: r.payer_code }));
  }
  const payers = mockStore().payers;
  return [...mockStore().insurancePolicies.values()]
    .filter((p) => p.clientId === clientId)
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.createdAt.localeCompare(b.createdAt))
    .map((p) => {
      const payer = payers.get(p.payerId);
      return { ...p, payerName: payer?.name ?? "Unknown payer", payerCode: payer?.payerCode ?? "" };
    });
}

export async function getPolicy(id: string): Promise<InsurancePolicy | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM insurance_policies WHERE id = ${id}`) as PolicyRow[];
    return rows[0] ? toPolicy(rows[0]) : null;
  }
  return mockStore().insurancePolicies.get(id) ?? null;
}

export interface CreatePolicyInput {
  clientId: string;
  payerId: string;
  memberId: string;
  groupId?: string | null;
  kind?: PolicyKind;
  status?: PolicyStatus;
  copayCents?: number | null;
}

export async function createPolicy(input: CreatePolicyInput): Promise<InsurancePolicy> {
  const kind: PolicyKind = input.kind ?? "primary";
  const status: PolicyStatus = input.status ?? "unverified";
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO insurance_policies (client_id, payer_id, member_id, group_id, kind, status, copay_cents)
      VALUES (${input.clientId}, ${input.payerId}, ${input.memberId}, ${input.groupId ?? null},
              ${kind}, ${status}, ${input.copayCents ?? null})
      RETURNING *
    `) as PolicyRow[];
    return toPolicy(rows[0]);
  }
  const now = new Date().toISOString();
  const policy: InsurancePolicy = {
    id: mockId(),
    clientId: input.clientId,
    payerId: input.payerId,
    memberId: input.memberId,
    groupId: input.groupId ?? null,
    kind,
    status,
    copayCents: input.copayCents ?? null,
    createdAt: now,
    updatedAt: now,
  };
  mockStore().insurancePolicies.set(policy.id, policy);
  return policy;
}

export type UpdatePolicyPatch = Partial<Omit<CreatePolicyInput, "clientId">>;

export async function updatePolicy(id: string, patch: UpdatePolicyPatch): Promise<InsurancePolicy | null> {
  const existing = await getPolicy(id);
  if (!existing) return null;
  const next: InsurancePolicy = {
    ...existing,
    payerId: patch.payerId ?? existing.payerId,
    memberId: patch.memberId ?? existing.memberId,
    groupId: patch.groupId !== undefined ? patch.groupId : existing.groupId,
    kind: patch.kind ?? existing.kind,
    status: patch.status ?? existing.status,
    copayCents: patch.copayCents !== undefined ? patch.copayCents : existing.copayCents,
    updatedAt: new Date().toISOString(),
  };
  if (hasDb) {
    const rows = (await sql`
      UPDATE insurance_policies SET
        payer_id = ${next.payerId}, member_id = ${next.memberId}, group_id = ${next.groupId},
        kind = ${next.kind}, status = ${next.status}, copay_cents = ${next.copayCents},
        updated_at = now()
      WHERE id = ${id} RETURNING *
    `) as PolicyRow[];
    return rows[0] ? toPolicy(rows[0]) : null;
  }
  mockStore().insurancePolicies.set(id, next);
  return next;
}

export async function deletePolicy(id: string): Promise<boolean> {
  if (hasDb) {
    const rows = (await sql`DELETE FROM insurance_policies WHERE id = ${id} RETURNING id`) as Array<{ id: string }>;
    return rows.length > 0;
  }
  return mockStore().insurancePolicies.delete(id);
}

import { hasDb, sql } from "@/lib/db";
import { mockId, mockStore } from "@/lib/mock";
import "@/lib/mock/payers";
import type { InsurancePolicy, Payer } from "@/lib/types";

// Payers repo — insurance payers + a read-only view over insurance_policies
// (owned by the clients domain) for policy counts and superbill data.

type PayerRow = {
  id: string;
  name: string;
  payer_code: string;
  created_at: string;
  updated_at: string;
  policy_count?: number;
};

function toPayer(r: PayerRow): Payer {
  return { id: r.id, name: r.name, payerCode: r.payer_code, createdAt: r.created_at, updatedAt: r.updated_at };
}

export interface PayerListItem extends Payer {
  policyCount: number;
}

export async function listPayers(): Promise<PayerListItem[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT p.*, COUNT(ip.id)::int AS policy_count
      FROM payers p LEFT JOIN insurance_policies ip ON ip.payer_id = p.id
      GROUP BY p.id ORDER BY p.name
    `) as PayerRow[];
    return rows.map((r) => ({ ...toPayer(r), policyCount: Number(r.policy_count ?? 0) }));
  }
  const store = mockStore();
  const policies = [...store.insurancePolicies.values()];
  return [...store.payers.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ ...p, policyCount: policies.filter((ip) => ip.payerId === p.id).length }));
}

export async function getPayer(id: string): Promise<Payer | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM payers WHERE id = ${id}`) as PayerRow[];
    return rows[0] ? toPayer(rows[0]) : null;
  }
  return mockStore().payers.get(id) ?? null;
}

export async function createPayer(input: { name: string; payerCode: string }): Promise<Payer> {
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO payers (name, payer_code) VALUES (${input.name}, ${input.payerCode}) RETURNING *
    `) as PayerRow[];
    return toPayer(rows[0]);
  }
  const now = new Date().toISOString();
  const payer: Payer = { id: mockId(), name: input.name, payerCode: input.payerCode, createdAt: now, updatedAt: now };
  mockStore().payers.set(payer.id, payer);
  return payer;
}

export async function updatePayer(
  id: string,
  patch: { name?: string; payerCode?: string },
): Promise<Payer | null> {
  const existing = await getPayer(id);
  if (!existing) return null;
  const name = patch.name ?? existing.name;
  const payerCode = patch.payerCode ?? existing.payerCode;
  if (hasDb) {
    const rows = (await sql`
      UPDATE payers SET name = ${name}, payer_code = ${payerCode}, updated_at = now()
      WHERE id = ${id} RETURNING *
    `) as PayerRow[];
    return rows[0] ? toPayer(rows[0]) : null;
  }
  const next = { ...existing, name, payerCode, updatedAt: new Date().toISOString() };
  mockStore().payers.set(id, next);
  return next;
}

export async function deletePayer(id: string): Promise<boolean> {
  if (hasDb) {
    const rows = (await sql`DELETE FROM payers WHERE id = ${id} RETURNING id`) as Array<{ id: string }>;
    return rows.length > 0;
  }
  return mockStore().payers.delete(id);
}

/** Client's insurance policies with payer names — superbill / print view. */
export async function policiesForClient(
  clientId: string,
): Promise<Array<InsurancePolicy & { payerName: string; payerCode: string }>> {
  if (hasDb) {
    const rows = (await sql`
      SELECT ip.*, p.name AS payer_name, p.payer_code
      FROM insurance_policies ip JOIN payers p ON p.id = ip.payer_id
      WHERE ip.client_id = ${clientId}
      ORDER BY ip.kind
    `) as Array<{
      id: string;
      client_id: string;
      payer_id: string;
      member_id: string;
      group_id: string | null;
      kind: InsurancePolicy["kind"];
      status: InsurancePolicy["status"];
      copay_cents: number | null;
      created_at: string;
      updated_at: string;
      payer_name: string;
      payer_code: string;
    }>;
    return rows.map((r) => ({
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
      payerName: r.payer_name,
      payerCode: r.payer_code,
    }));
  }
  const store = mockStore();
  return [...store.insurancePolicies.values()]
    .filter((ip) => ip.clientId === clientId)
    .sort((a, b) => a.kind.localeCompare(b.kind))
    .map((ip) => {
      const payer = store.payers.get(ip.payerId);
      return { ...ip, payerName: payer?.name ?? "Unknown payer", payerCode: payer?.payerCode ?? "" };
    });
}

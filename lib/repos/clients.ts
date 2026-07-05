import { hasDb, sql } from "@/lib/db";
import { mockId, mockStore } from "@/lib/mock";
import "@/lib/mock/clients";
import type { AvatarHue, Client, ClientStatus } from "@/lib/types";

// Clients repo. hasDb → Postgres; otherwise the in-memory mock store
// (fixtures mirror sql/002_seed.sql).

type ClientRow = {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  dob: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gender: string | null;
  pronouns: string | null;
  status: ClientStatus;
  tags: string[] | null;
  primary_practitioner_id: string | null;
  created_at: string;
  updated_at: string;
};

function toClient(r: ClientRow): Client {
  return {
    id: r.id,
    userId: r.user_id,
    firstName: r.first_name,
    lastName: r.last_name,
    dob: r.dob,
    email: r.email,
    phone: r.phone,
    address: r.address,
    gender: r.gender,
    pronouns: r.pronouns,
    status: r.status,
    tags: r.tags ?? [],
    primaryPractitionerId: r.primary_practitioner_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface ClientFilters {
  q?: string;
  status?: ClientStatus;
  tag?: string;
}

export async function listClients(f?: ClientFilters): Promise<Client[]> {
  if (hasDb) {
    const q = f?.q?.trim() || null;
    const rows = (await sql`
      SELECT * FROM clients
      WHERE (${q}::text IS NULL
             OR first_name || ' ' || last_name ILIKE '%' || ${q} || '%'
             OR email ILIKE '%' || ${q} || '%'
             OR phone ILIKE '%' || ${q} || '%')
        AND (${f?.status ?? null}::text IS NULL OR status = ${f?.status ?? null})
        AND (${f?.tag ?? null}::text IS NULL OR ${f?.tag ?? null} = ANY(tags))
      ORDER BY first_name, last_name
    `) as ClientRow[];
    return rows.map(toClient);
  }
  const q = f?.q?.trim().toLowerCase();
  return [...mockStore().clients.values()]
    .filter((c) => {
      if (f?.status && c.status !== f.status) return false;
      if (f?.tag && !c.tags.includes(f.tag)) return false;
      if (q) {
        const hay = `${c.firstName} ${c.lastName} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
}

export async function getClient(id: string): Promise<Client | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM clients WHERE id = ${id}`) as ClientRow[];
    return rows[0] ? toClient(rows[0]) : null;
  }
  return mockStore().clients.get(id) ?? null;
}

export interface CreateClientInput {
  firstName: string;
  lastName: string;
  dob?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gender?: string | null;
  pronouns?: string | null;
  status?: ClientStatus;
  tags?: string[];
  primaryPractitionerId?: string | null;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const status: ClientStatus = input.status ?? "active";
  const tags = input.tags ?? [];
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO clients (first_name, last_name, dob, email, phone, address, gender, pronouns,
                           status, tags, primary_practitioner_id)
      VALUES (${input.firstName}, ${input.lastName}, ${input.dob ?? null}, ${input.email ?? null},
              ${input.phone ?? null}, ${input.address ?? null}, ${input.gender ?? null},
              ${input.pronouns ?? null}, ${status}, ${tags}, ${input.primaryPractitionerId ?? null})
      RETURNING *
    `) as ClientRow[];
    return toClient(rows[0]);
  }
  const now = new Date().toISOString();
  const client: Client = {
    id: mockId(),
    userId: null,
    firstName: input.firstName,
    lastName: input.lastName,
    dob: input.dob ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    gender: input.gender ?? null,
    pronouns: input.pronouns ?? null,
    status,
    tags,
    primaryPractitionerId: input.primaryPractitionerId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  mockStore().clients.set(client.id, client);
  return client;
}

export type UpdateClientPatch = Partial<CreateClientInput>;

export async function updateClient(id: string, patch: UpdateClientPatch): Promise<Client | null> {
  const existing = await getClient(id);
  if (!existing) return null;
  const next: Client = {
    ...existing,
    firstName: patch.firstName ?? existing.firstName,
    lastName: patch.lastName ?? existing.lastName,
    dob: patch.dob !== undefined ? patch.dob : existing.dob,
    email: patch.email !== undefined ? patch.email : existing.email,
    phone: patch.phone !== undefined ? patch.phone : existing.phone,
    address: patch.address !== undefined ? patch.address : existing.address,
    gender: patch.gender !== undefined ? patch.gender : existing.gender,
    pronouns: patch.pronouns !== undefined ? patch.pronouns : existing.pronouns,
    status: patch.status ?? existing.status,
    tags: patch.tags ?? existing.tags,
    primaryPractitionerId:
      patch.primaryPractitionerId !== undefined ? patch.primaryPractitionerId : existing.primaryPractitionerId,
    updatedAt: new Date().toISOString(),
  };
  if (hasDb) {
    const rows = (await sql`
      UPDATE clients SET
        first_name = ${next.firstName}, last_name = ${next.lastName}, dob = ${next.dob},
        email = ${next.email}, phone = ${next.phone}, address = ${next.address},
        gender = ${next.gender}, pronouns = ${next.pronouns}, status = ${next.status},
        tags = ${next.tags}, primary_practitioner_id = ${next.primaryPractitionerId},
        updated_at = now()
      WHERE id = ${id} RETURNING *
    `) as ClientRow[];
    return rows[0] ? toClient(rows[0]) : null;
  }
  mockStore().clients.set(id, next);
  return next;
}

export interface PractitionerOption {
  id: string;
  name: string;
  avatarHue: AvatarHue;
}

/** Staff users for the "Primary practitioner" Select. */
export async function listPractitioners(): Promise<PractitionerOption[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT id, name, avatar_hue FROM users
      WHERE role IN ('admin', 'practitioner') AND deleted_at IS NULL
      ORDER BY name
    `) as Array<{ id: string; name: string; avatar_hue: AvatarHue }>;
    return rows.map((r) => ({ id: r.id, name: r.name, avatarHue: r.avatar_hue }));
  }
  return [...mockStore().users.values()]
    .filter((u) => (u.role === "admin" || u.role === "practitioner") && !u.deletedAt)
    .map((u) => ({ id: u.id, name: u.name, avatarHue: u.avatarHue }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

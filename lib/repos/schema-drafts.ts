import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";
import type { SchemaDraftDoc, SchemaDraftMeta } from "@/lib/schema-draft";

// Saved schema-redesign drafts (sql/070) — owner-scoped CRUD, same shape as
// lib/repos/canvas.ts's map CRUD. No edge hydration here: unlike /maps, a
// draft's edges are user-invented and stored as-is, never re-derived.

export type { SchemaDraftDoc, SchemaDraftMeta };

const mockDrafts = new Map<string, { meta: SchemaDraftMeta; doc: SchemaDraftDoc }>();

export async function listSchemaDrafts(ownerId: string): Promise<SchemaDraftMeta[]> {
  if (!hasDb) {
    return [...mockDrafts.values()].map((m) => m.meta).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const rows = (await sql`
    SELECT id, name, updated_at FROM schema_drafts
    WHERE owner_id = ${ownerId} ORDER BY updated_at DESC LIMIT 100
  `) as Array<{ id: string; name: string; updated_at: Date }>;
  return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: isoDateTime(r.updated_at) }));
}

export async function getSchemaDraft(
  ownerId: string,
  id: string,
): Promise<{ meta: SchemaDraftMeta; doc: SchemaDraftDoc } | null> {
  if (!hasDb) return mockDrafts.get(id) ?? null;
  const rows = (await sql`
    SELECT id, name, doc, updated_at FROM schema_drafts
    WHERE owner_id = ${ownerId} AND id = ${id} LIMIT 1
  `) as Array<{ id: string; name: string; doc: SchemaDraftDoc; updated_at: Date }>;
  const r = rows[0];
  return r ? { meta: { id: r.id, name: r.name, updatedAt: isoDateTime(r.updated_at) }, doc: r.doc } : null;
}

export async function createSchemaDraft(
  ownerId: string,
  name: string,
  doc: SchemaDraftDoc,
): Promise<SchemaDraftMeta> {
  if (!hasDb) {
    const meta = { id: `mock-${Date.now()}`, name, updatedAt: new Date().toISOString() };
    mockDrafts.set(meta.id, { meta, doc });
    return meta;
  }
  const rows = (await sql`
    INSERT INTO schema_drafts (owner_id, name, doc)
    VALUES (${ownerId}, ${name}, ${JSON.stringify(doc)}::jsonb)
    RETURNING id, name, updated_at
  `) as Array<{ id: string; name: string; updated_at: Date }>;
  const r = rows[0];
  return { id: r.id, name: r.name, updatedAt: isoDateTime(r.updated_at) };
}

export async function updateSchemaDraft(
  ownerId: string,
  id: string,
  patch: { name?: string; doc?: SchemaDraftDoc },
): Promise<boolean> {
  if (!hasDb) {
    const hit = mockDrafts.get(id);
    if (!hit) return false;
    if (patch.name) hit.meta.name = patch.name;
    if (patch.doc) hit.doc = patch.doc;
    hit.meta.updatedAt = new Date().toISOString();
    return true;
  }
  const rows = (await sql`
    UPDATE schema_drafts
    SET name = COALESCE(${patch.name ?? null}, name),
        doc  = COALESCE(${patch.doc ? JSON.stringify(patch.doc) : null}::jsonb, doc),
        updated_at = now()
    WHERE owner_id = ${ownerId} AND id = ${id}
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

export async function deleteSchemaDraft(ownerId: string, id: string): Promise<boolean> {
  if (!hasDb) return mockDrafts.delete(id);
  const rows = (await sql`
    DELETE FROM schema_drafts WHERE owner_id = ${ownerId} AND id = ${id} RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

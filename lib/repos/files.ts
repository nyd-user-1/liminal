import { auditRead } from "@/lib/audit";
import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";
import { mockId, mockStore } from "@/lib/mock";
import "@/lib/mock/files";
import type { FileKind, FileProvenance, FileRecord, FileStorage } from "@/lib/types";

// Client files repo — metadata rows only. Bytes live in the PRIVATE Vercel Blob
// store and are served solely through GET /api/files/download (see
// app/api/files/route.ts). hasDb → Postgres; otherwise the in-memory store.

type FileRow = {
  id: string;
  client_id: string;
  uploader_id: string;
  name: string;
  mime: string;
  size_bytes: number;
  url: string;
  kind: FileKind;
  storage: FileStorage | null;
  provenance: FileProvenance | null;
  created_at: string | Date;
};

function toFile(r: FileRow): FileRecord {
  return {
    id: r.id,
    clientId: r.client_id,
    uploaderId: r.uploader_id,
    name: r.name,
    mime: r.mime,
    sizeBytes: Number(r.size_bytes),
    url: r.url,
    kind: r.kind,
    // Pre-062 rows carry no columns; derive from the stored path shape.
    storage: r.storage ?? (r.url.startsWith("/uploads/") ? "local" : "blob"),
    provenance: r.provenance ?? "user_upload",
    createdAt: isoDateTime(r.created_at),
  };
}

/** Document metadata read (PHI) — audited. */
export async function getFile(id: string): Promise<FileRecord | null> {
  let file: FileRecord | null;
  if (hasDb) {
    const rows = (await sql`SELECT * FROM files WHERE id = ${id}`) as FileRow[];
    file = rows[0] ? toFile(rows[0]) : null;
  } else {
    file = mockStore().files.get(id) ?? null;
  }
  if (file) await auditRead("file.view", "file", file.id, { clientId: file.clientId });
  return file;
}

/** A client's documents (PHI) — audited. */
export async function listFiles(clientId: string): Promise<FileRecord[]> {
  let files: FileRecord[];
  if (hasDb) {
    const rows = (await sql`
      SELECT * FROM files WHERE client_id = ${clientId} ORDER BY created_at DESC
    `) as FileRow[];
    files = rows.map(toFile);
  } else {
    files = [...mockStore().files.values()]
      .filter((f) => f.clientId === clientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  await auditRead("file.list", "client", clientId, { count: files.length });
  return files;
}

/**
 * Uploader display names by user id — the "who uploaded" column. Names only,
 * no PHI beyond them, and not audited: a name lookup is not a record read.
 * Ids with no matching user fall back to "Practitioner" at the call site.
 */
export async function uploaderNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  if (hasDb) {
    const rows = (await sql`SELECT id, name FROM users WHERE id = ANY(${unique})`) as Array<{
      id: string;
      name: string;
    }>;
    return Object.fromEntries(rows.map((r) => [r.id, r.name]));
  }
  const users = mockStore().users;
  return Object.fromEntries(unique.filter((id) => users.has(id)).map((id) => [id, users.get(id)!.name]));
}

export interface SaveFileMeta {
  clientId: string;
  uploaderId: string;
  /** Client-supplied filename — stored verbatim (it is their data). */
  name: string;
  mime: string;
  sizeBytes: number;
  /** Private blob pathname (or /uploads/<name> in dev). Never a public URL. */
  url: string;
  kind?: FileKind;
  /** Defaults to "blob"; "local" only for the dev disk fallback. */
  storage?: FileStorage;
  /** Defaults to "user_upload". Seeded demo rows MUST pass "demo_seed". */
  provenance?: FileProvenance;
}

export async function saveFile(meta: SaveFileMeta): Promise<FileRecord> {
  const kind: FileKind = meta.kind ?? "upload";
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO files (client_id, uploader_id, name, mime, size_bytes, url, kind, storage, provenance)
      VALUES (${meta.clientId}, ${meta.uploaderId}, ${meta.name}, ${meta.mime},
              ${meta.sizeBytes}, ${meta.url}, ${kind},
              ${meta.storage ?? "blob"}, ${meta.provenance ?? "user_upload"})
      RETURNING *
    `) as FileRow[];
    return toFile(rows[0]);
  }
  const record: FileRecord = {
    id: mockId(),
    clientId: meta.clientId,
    uploaderId: meta.uploaderId,
    name: meta.name,
    mime: meta.mime,
    sizeBytes: meta.sizeBytes,
    url: meta.url,
    kind,
    storage: meta.storage ?? "blob",
    provenance: meta.provenance ?? "user_upload",
    createdAt: new Date().toISOString(),
  };
  mockStore().files.set(record.id, record);
  return record;
}

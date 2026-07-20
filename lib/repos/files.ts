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
  const file = await fetchFileRow(id);
  if (file) await auditRead("file.view", "file", file.id, { clientId: file.clientId });
  return file;
}

/**
 * The row WITHOUT emitting an access audit.
 *
 * Only for callers that must authorize BEFORE the access is recorded — a
 * download handler has to read `client_id` to decide whether the requester may
 * have the file at all, and auditing that lookup as a view records an access
 * that was in fact refused. A denied request logged as `file.view` corrupts the
 * trail in the direction that matters: a later investigation sees a view that
 * never happened.
 *
 * A caller using this **must** record the real outcome itself — the access when
 * it is allowed, the denial when it is not. Do not reach for this to skip
 * auditing; `getFile` is the default for a reason.
 */
export async function getFileForAuthCheck(id: string): Promise<FileRecord | null> {
  return fetchFileRow(id);
}

async function fetchFileRow(id: string): Promise<FileRecord | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM files WHERE id = ${id}`) as FileRow[];
    return rows[0] ? toFile(rows[0]) : null;
  }
  return mockStore().files.get(id) ?? null;
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

/** How many times a document's bytes went out, and to whom most recently. */
export interface FileAccess {
  /** Successful byte deliveries. */
  downloads: number;
  /** The most recent delivery, ISO. */
  lastAt: string;
  /** User id of the most recent downloader — null if the actor no longer resolves. */
  lastById: string | null;
  /** Display name of the most recent downloader — null if it no longer resolves. */
  lastByName: string | null;
}

/**
 * Download history for a set of documents, keyed by file id. Files that were
 * never downloaded are simply absent from the result.
 *
 * Counts `file.download` and NOTHING else, deliberately:
 *
 *  - A successful download writes BOTH `file.view` (once authorized) and
 *    `file.download` (once the bytes are out), so counting the two together
 *    would double every access.
 *  - `file.view` rows written before af5b0e3 cannot be trusted. The download
 *    handler audited its lookup BEFORE authorizing, so a REFUSED request left a
 *    `file.view` behind claiming an access that never happened. Those phantoms
 *    have no `file.download` next to them, so counting deliveries steps around
 *    them instead of surfacing a view that never occurred.
 *
 * The number therefore means exactly one thing: the bytes were served this many
 * times. Not audited itself — asking who touched a record is not a record read,
 * and both surfaces that call this already log their own view.
 */
export async function fileAccessHistory(fileIds: string[]): Promise<Record<string, FileAccess>> {
  const ids = [...new Set(fileIds.filter(Boolean))];
  if (ids.length === 0) return {};

  if (hasDb) {
    const rows = (await sql`
      SELECT a.entity_id,
             count(*)::int                            AS downloads,
             max(a.at)                                AS last_at,
             (array_agg(a.actor_id ORDER BY a.at DESC))[1] AS last_by_id,
             (array_agg(u.name     ORDER BY a.at DESC))[1] AS last_by_name
        FROM audit_events a
        LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.entity = 'file'
         AND a.action = 'file.download'
         AND a.entity_id = ANY(${ids}::text[])
       GROUP BY a.entity_id
    `) as Array<{
      entity_id: string;
      downloads: number;
      last_at: string | Date;
      last_by_id: string | null;
      last_by_name: string | null;
    }>;
    return Object.fromEntries(
      rows.map((r) => [
        r.entity_id,
        {
          downloads: Number(r.downloads),
          lastAt: isoDateTime(r.last_at),
          lastById: r.last_by_id,
          lastByName: r.last_by_name,
        },
      ]),
    );
  }

  const wanted = new Set(ids);
  const users = mockStore().users;
  const out: Record<string, FileAccess> = {};
  for (const e of mockStore().auditEvents) {
    if (e.entity !== "file" || e.action !== "file.download" || !e.entityId || !wanted.has(e.entityId)) continue;
    const prev = out[e.entityId];
    // Events accumulate in order, so a later row is always the more recent one.
    out[e.entityId] = {
      downloads: (prev?.downloads ?? 0) + 1,
      lastAt: e.at,
      lastById: e.actorId,
      lastByName: e.actorId ? (users.get(e.actorId)?.name ?? null) : null,
    };
  }
  return out;
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

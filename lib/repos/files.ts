import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";
import { mockId, mockStore } from "@/lib/mock";
import "@/lib/mock/files";
import type { FileKind, FileRecord } from "@/lib/types";

// Client files repo — metadata rows only; bytes live in ./uploads (see
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
    createdAt: isoDateTime(r.created_at),
  };
}

export async function listFiles(clientId: string): Promise<FileRecord[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT * FROM files WHERE client_id = ${clientId} ORDER BY created_at DESC
    `) as FileRow[];
    return rows.map(toFile);
  }
  return [...mockStore().files.values()]
    .filter((f) => f.clientId === clientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface SaveFileMeta {
  clientId: string;
  uploaderId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  url: string;
  kind?: FileKind;
}

export async function saveFile(meta: SaveFileMeta): Promise<FileRecord> {
  const kind: FileKind = meta.kind ?? "upload";
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO files (client_id, uploader_id, name, mime, size_bytes, url, kind)
      VALUES (${meta.clientId}, ${meta.uploaderId}, ${meta.name}, ${meta.mime},
              ${meta.sizeBytes}, ${meta.url}, ${kind})
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
    createdAt: new Date().toISOString(),
  };
  mockStore().files.set(record.id, record);
  return record;
}

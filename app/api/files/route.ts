import { NextResponse, type NextRequest } from "next/server";
import { blobPut } from "@/lib/blob";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { listFiles, saveFile } from "@/lib/repos/files";
import type { FileKind } from "@/lib/types";

// Client documents (PHI). Multipart POST (fields: file, clientId, kind?) →
// bytes to the PRIVATE Vercel Blob store under an opaque key + a files row.
// Never the public store: that one is for marketing assets and hands out a
// plain CDN URL. Bytes come back only via GET /api/files/download.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const KINDS: FileKind[] = ["upload", "form_pdf", "superbill"];

// Extension for the stored key, from the browser-reported MIME type. Keeps the
// key opaque while letting a human eyeball a blob listing. Unknown → none.
const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/heic": ".heic",
  "image/webp": ".webp",
  "text/plain": ".txt",
  "text/csv": ".csv",
};

function extensionFor(mime: string): string {
  return EXT_BY_MIME[mime] ?? "";
}

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/** GET /api/files?clientId= — a client's file list (PHI read, audited). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId is required." }, { status: 400 });
    const files = await listFiles(clientId);
    await logEvent({ actorId: user.id, action: "file.list", entity: "client", entityId: clientId });
    return NextResponse.json({ files });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

/** POST /api/files (multipart: file, clientId, kind?) — upload + record. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");

    let file: File | null = null;
    let clientId = "";
    let kind: FileKind = "upload";
    try {
      const form = await req.formData();
      const f = form.get("file");
      if (f instanceof File) file = f;
      const c = form.get("clientId");
      if (typeof c === "string") clientId = c;
      const k = form.get("kind");
      if (typeof k === "string" && KINDS.includes(k as FileKind)) kind = k as FileKind;
    } catch {
      return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
    }
    if (!file) return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    if (!clientId) return NextResponse.json({ error: "clientId is required." }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "That file is too large (10 MB max)." }, { status: 400 });
    }

    // Refuse rather than write bytes that will not survive. The disk fallback
    // this route used to take is read-only/ephemeral on serverless, so it
    // produced file rows pointing at nothing — a record that is not a record.
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Document storage is not configured. Set BLOB_READ_WRITE_TOKEN." },
        { status: 503 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // The stored key is OPAQUE on purpose: a filename is the client's data and
    // can name a condition ("hiv-results.pdf"). Blob pathnames end up in
    // storage listings and logs, so nothing we mint may carry PHI. The display
    // name lives only in the files row. Extension comes from the browser's
    // MIME type, never from the supplied name.
    const key = `clients/${clientId}/${crypto.randomUUID()}${extensionFor(file.type)}`;
    const blob = await blobPut(key, bytes, {
      access: "private",
      contentType: file.type || "application/octet-stream",
    });

    const record = await saveFile({
      clientId,
      uploaderId: user.id,
      name: file.name || "upload", // client-supplied, stored verbatim
      mime: file.type || "application/octet-stream",
      sizeBytes: file.size,
      url: blob.pathname, // a pathname, not a fetchable URL
      kind,
      storage: "blob",
      provenance: "user_upload",
    });
    await logEvent({
      actorId: user.id,
      action: "file.upload",
      entity: "file",
      entityId: record.id,
      meta: { clientId, kind, sizeBytes: file.size },
    });
    return NextResponse.json({ file: record }, { status: 201 });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

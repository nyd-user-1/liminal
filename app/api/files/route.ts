import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { listFiles, saveFile } from "@/lib/repos/files";
import type { FileKind } from "@/lib/types";

// Client file uploads. Multipart POST (fields: file, clientId, kind?) →
// bytes land in ./uploads locally (no blob store in v1; adapted from the
// tariffs portal/entry pattern) + a files metadata row.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const KINDS: FileKind[] = ["upload", "form_pdf", "superbill"];

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

    // Store bytes under ./uploads with a random prefix so names can't collide
    // (or traverse — the original name is sanitized to a safe charset).
    const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `${crypto.randomUUID().slice(0, 8)}-${safeName}`;
    const dir = path.join(process.cwd(), "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));

    const record = await saveFile({
      clientId,
      uploaderId: user.id,
      name: file.name || safeName,
      mime: file.type || "application/octet-stream",
      sizeBytes: file.size,
      url: `/uploads/${storedName}`,
      kind,
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

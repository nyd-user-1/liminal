import { readFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { auditRead, logEvent } from "@/lib/audit";
import { blobGetPrivate } from "@/lib/blob";
import { getFileForAuthCheck } from "@/lib/repos/files";
import { clientForUser } from "@/lib/repos/threads";

// Authenticated download proxy for client files (PHI). The blob store is
// private, so bytes are never fetchable by URL — every download comes through
// here: authenticate → authorize (practitioner/admin, or the file's own
// client) → stream from Blob (or ./uploads in local dev) → audit.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    // Fetch WITHOUT auditing, authorize, and only then record what actually
    // happened. Auditing the lookup itself would log a refused request as a
    // view — a denial recorded as an access is worse than no record at all,
    // because an investigation would see a view that never occurred.
    const file = await getFileForAuthCheck(id);
    if (!file) return new NextResponse("Not found", { status: 404 });

    // Authorize: staff see any file; a client may only fetch their own.
    const isStaff = user.role === "practitioner" || user.role === "admin";
    if (!isStaff) {
      const client = await clientForUser(user.id);
      if (!client || client.id !== file.clientId) {
        await logEvent({
          actorId: user.id,
          action: "file.access_denied",
          entity: "file",
          entityId: file.id,
          meta: { clientId: file.clientId },
        });
        return new NextResponse("Not found", { status: 404 });
      }
    }

    // Authorized — this is the access, and it is the one that gets recorded.
    await auditRead("file.view", "file", file.id, { clientId: file.clientId });

    const disposition = `attachment; filename="${file.name.replace(/["\\]/g, "_")}"`;
    let body: BodyInit;
    let contentType = file.mime || "application/octet-stream";

    if (file.storage === "local") {
      // Legacy/dev rows: bytes under ./uploads, which does not exist on
      // serverless. Say so plainly rather than 404-ing as if the row were bogus.
      try {
        body = await readFile(path.join(process.cwd(), "uploads", path.basename(file.url)));
      } catch {
        await logEvent({
          actorId: user.id,
          action: "file.download.missing",
          entity: "file",
          entityId: file.id,
          meta: { clientId: file.clientId, storage: file.storage },
        });
        return NextResponse.json(
          { error: "This document predates durable storage and has no bytes on file." },
          { status: 410 },
        );
      }
    } else {
      // Private Blob — file.url holds the blob pathname. Bytes are streamed
      // through this handler rather than redirecting to a signed URL: a signed
      // URL is a bearer token that can be copied out of the browser and
      // replayed unauthenticated until it expires. Proxying keeps every byte
      // fetch behind requireUser() and inside the audit trail.
      const result = await blobGetPrivate(file.url);
      if (result === null || result.statusCode !== 200) {
        return new NextResponse("Not found", { status: 404 });
      }
      body = result.stream;
      contentType = result.blob.contentType || contentType;
    }

    await logEvent({
      actorId: user.id,
      action: "file.download",
      entity: "file",
      entityId: file.id,
      meta: { clientId: file.clientId },
    });

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

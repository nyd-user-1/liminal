import { readFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { blobGetPrivate } from "@/lib/blob";
import { getFile } from "@/lib/repos/files";
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

    const file = await getFile(id);
    if (!file) return new NextResponse("Not found", { status: 404 });

    // Authorize: staff see any file; a client may only fetch their own.
    const isStaff = user.role === "practitioner" || user.role === "admin";
    if (!isStaff) {
      const client = await clientForUser(user.id);
      if (!client || client.id !== file.clientId) {
        return new NextResponse("Not found", { status: 404 });
      }
    }

    const disposition = `attachment; filename="${file.name.replace(/["\\]/g, "_")}"`;
    let body: BodyInit;
    let contentType = file.mime || "application/octet-stream";

    if (file.url.startsWith("/uploads/")) {
      // Local-dev disk fallback (bytes under ./uploads).
      const bytes = await readFile(path.join(process.cwd(), "uploads", path.basename(file.url)));
      body = bytes;
    } else {
      // Private Blob — file.url holds the blob pathname.
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

import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { addAmendment, listAmendments } from "@/lib/repos/notes";

// Amendments to a clinical note. A signed note is a legal attestation and is
// never edited — a correction is an appended addendum carrying its own author
// and timestamp. Append-only: there is deliberately no PATCH or DELETE here.

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function onAuthError(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e;
}

/** GET /api/notes/:id/amendments → the correction chain, oldest first. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const amendments = await listAmendments(id);
    await logEvent({
      actorId: user.id,
      action: "note.amendments.view",
      entity: "note",
      entityId: id,
      meta: { count: amendments.length },
    });
    return NextResponse.json({ amendments });
  } catch (e) {
    return onAuthError(e);
  }
}

/** POST /api/notes/:id/amendments { bodyMd } — append a correction. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;

    let body: { bodyMd?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const bodyMd = typeof body.bodyMd === "string" ? body.bodyMd.trim() : "";
    if (!bodyMd) return NextResponse.json({ error: "An amendment needs a body." }, { status: 400 });

    const amendment = await addAmendment({ noteId: id, authorId: user.id, bodyMd });
    if (!amendment) return NextResponse.json({ error: "Note not found." }, { status: 404 });

    await logEvent({
      actorId: user.id,
      action: "note.amend",
      entity: "note",
      entityId: id,
      meta: { amendmentId: amendment.id },
    });
    return NextResponse.json({ amendment }, { status: 201 });
  } catch (e) {
    return onAuthError(e);
  }
}

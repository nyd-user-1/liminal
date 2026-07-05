import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { getNote, signNote } from "@/lib/repos/notes";

export const dynamic = "force-dynamic";

/**
 * POST /api/notes/:id/sign — draft → signed (stamps signed_at);
 * a second confirm on a signed note → locked (immutable).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const existing = await getNote(id);
    if (!existing) return NextResponse.json({ error: "Note not found." }, { status: 404 });
    if (existing.status === "locked") {
      return NextResponse.json({ error: "This note is already locked." }, { status: 409 });
    }
    const note = await signNote(id);
    await logEvent({
      actorId: user.id,
      action: "note.sign",
      entity: "note",
      entityId: id,
      meta: { from: existing.status, to: note?.status },
    });
    return NextResponse.json({ note });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

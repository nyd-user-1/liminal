import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { authorNames, clientNames, deleteNote, getNote, getTranscript, updateNote } from "@/lib/repos/notes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function onAuthError(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e;
}

/** GET /api/notes/:id → { note, author, client, transcript } (PHI read → audit). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const note = await getNote(id);
    if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });
    const [authors, clients, transcript] = await Promise.all([
      authorNames([note.authorId]),
      clientNames([note.clientId]),
      note.appointmentId ? getTranscript(note.appointmentId) : Promise.resolve(null),
    ]);
    await logEvent({ actorId: user.id, action: "note.view", entity: "note", entityId: note.id });
    return NextResponse.json({
      note,
      author: authors[note.authorId] ?? "Practitioner",
      client: clients[note.clientId] ?? "Client",
      transcript,
    });
  } catch (e) {
    return onAuthError(e);
  }
}

/** PATCH /api/notes/:id { title?, bodyMd? } — locked notes are immutable (409). */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const existing = await getNote(id);
    if (!existing) return NextResponse.json({ error: "Note not found." }, { status: 404 });
    if (existing.status === "locked") {
      return NextResponse.json({ error: "This note is signed and locked." }, { status: 409 });
    }
    let body: { title?: unknown; bodyMd?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const note = await updateNote(id, {
      title: typeof body.title === "string" ? body.title : undefined,
      bodyMd: typeof body.bodyMd === "string" ? body.bodyMd : undefined,
    });
    await logEvent({ actorId: user.id, action: "note.update", entity: "note", entityId: id });
    return NextResponse.json({ note });
  } catch (e) {
    return onAuthError(e);
  }
}

/** DELETE /api/notes/:id — soft delete (clinical data is never hard-deleted). */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const ok = await deleteNote(id);
    if (!ok) return NextResponse.json({ error: "Note not found." }, { status: 404 });
    await logEvent({ actorId: user.id, action: "note.delete", entity: "note", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return onAuthError(e);
  }
}

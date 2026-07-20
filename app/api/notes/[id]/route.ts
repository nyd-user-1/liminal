import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import {
  authorNames,
  clientNames,
  deleteNote,
  getNote,
  getNoteWithAmendments,
  getTranscript,
  isEditable,
  NoteLockedError,
  updateNote,
} from "@/lib/repos/notes";

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
    const note = await getNoteWithAmendments(id);
    if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });
    const [authors, clients, transcript] = await Promise.all([
      authorNames([note.authorId, ...note.amendments.map((a) => a.authorId)]),
      clientNames([note.clientId]),
      note.appointmentId ? getTranscript(note.appointmentId) : Promise.resolve(null),
    ]);
    // getNoteWithAmendments() audits the read inside the repo — no log here.
    return NextResponse.json({
      note,
      author: authors[note.authorId] ?? "Practitioner",
      authors, // amendment authors, by id
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
    if (!isEditable(existing)) {
      return NextResponse.json(
        { error: "This note is signed. Corrections must be filed as an amendment." },
        { status: 409 },
      );
    }
    let body: { title?: unknown; bodyMd?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    let note;
    try {
      note = await updateNote(id, {
        title: typeof body.title === "string" ? body.title : undefined,
        bodyMd: typeof body.bodyMd === "string" ? body.bodyMd : undefined,
      });
    } catch (e) {
      // Lost the race against a concurrent sign — the repo is the authority.
      if (e instanceof NoteLockedError) return NextResponse.json({ error: e.message }, { status: 409 });
      throw e;
    }
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

import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { amendmentCountsFor, authorNames, createNote, listNotes, listTemplates } from "@/lib/repos/notes";
import type { NoteStatus, NoteTemplateKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS: NoteTemplateKind[] = ["soap", "dap", "progress", "intake", "free"];
const STATUSES: NoteStatus[] = ["draft", "signed", "locked"];

function onAuthError(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e;
}

/**
 * GET /api/notes?clientId=&status= → { notes, authors, amendmentCounts }
 *
 * amendmentCounts lets a timeline badge a signed-and-amended note without a
 * fetch per row. Notes with no amendments are absent from the map, not 0.
 * The read itself is audited inside listNotes() (action "note.list").
 */
export async function GET(req: Request) {
  try {
    await requireRole("practitioner");
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId") ?? undefined;
    const statusParam = url.searchParams.get("status");
    const status = STATUSES.includes(statusParam as NoteStatus) ? (statusParam as NoteStatus) : undefined;
    const notes = await listNotes({ clientId, status });
    const noteIds = notes.map((n) => n.id);
    const [authors, amendmentCounts] = await Promise.all([
      authorNames(notes.map((n) => n.authorId)),
      amendmentCountsFor(noteIds),
    ]);
    return NextResponse.json({ notes, authors, amendmentCounts });
  } catch (e) {
    return onAuthError(e);
  }
}

/** POST /api/notes { clientId, template, title?, bodyMd?, appointmentId? } */
export async function POST(req: Request) {
  try {
    const user = await requireRole("practitioner");
    let body: {
      clientId?: unknown;
      template?: unknown;
      title?: unknown;
      bodyMd?: unknown;
      appointmentId?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const clientId = typeof body.clientId === "string" ? body.clientId : "";
    const template = KINDS.includes(body.template as NoteTemplateKind)
      ? (body.template as NoteTemplateKind)
      : "free";
    if (!clientId) return NextResponse.json({ error: "clientId is required." }, { status: 400 });

    // Default the body to the template skeleton and the title to "{Template} {M/D}".
    let bodyMd = typeof body.bodyMd === "string" ? body.bodyMd : "";
    let title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "";
    if (!bodyMd || !title) {
      const t = (await listTemplates()).find((x) => x.template === template);
      if (!bodyMd) bodyMd = t?.bodyMd ?? "";
      if (!title) {
        const d = new Date();
        title = `${t?.name ?? "Note"} ${d.getMonth() + 1}/${d.getDate()}`;
      }
    }

    const note = await createNote({
      clientId,
      authorId: user.id,
      template,
      title,
      bodyMd,
      appointmentId: typeof body.appointmentId === "string" ? body.appointmentId : null,
    });
    await logEvent({
      actorId: user.id,
      action: "note.create",
      entity: "note",
      entityId: note.id,
      meta: { template, clientId },
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (e) {
    return onAuthError(e);
  }
}

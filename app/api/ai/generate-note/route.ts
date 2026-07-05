import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { hasDb, sql } from "@/lib/db";
import { mockStore } from "@/lib/mock";
import { createNote, getTranscript, listNotes, listTemplates, saveTranscript } from "@/lib/repos/notes";
import type { NoteTemplateKind, TranscriptSegment } from "@/lib/types";
import { DEMO_SEGMENTS, delay, generatedNote } from "../demo-script";

export const dynamic = "force-dynamic";

// Which client was this session with? appointment row → prior note on the
// same appointment → explicit clientId in the request body.
async function resolveClientId(appointmentId: string, explicit: string | null): Promise<string | null> {
  if (hasDb) {
    const rows = (await sql`SELECT client_id FROM appointments WHERE id = ${appointmentId}`) as Array<{
      client_id: string;
    }>;
    if (rows[0]) return rows[0].client_id;
  } else {
    const appt = mockStore().appointments.get(appointmentId);
    if (appt) return appt.clientId;
  }
  const linked = (await listNotes()).find((n) => n.appointmentId === appointmentId);
  return linked?.clientId ?? explicit;
}

/**
 * POST /api/ai/generate-note
 *   { appointmentId, template, clientId?, perspective?, verbosity?, extraNotes? }
 *     → creates a draft note from the session transcript (extraNotes appended
 *     as a practitioner-addendum section) and returns { note }.
 *   { transcript, template } → returns { title, bodyMd, summaryMd } only.
 *
 * STUB — wire an LLM key here (template body_md is the prompt skeleton; the
 * transcript + perspective/verbosity settings are the context). The stub
 * returns realistic canned psychiatry markdown matched to the transcript.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("practitioner");
    let body: {
      appointmentId?: unknown;
      clientId?: unknown;
      transcript?: unknown;
      template?: unknown;
      perspective?: unknown;
      verbosity?: unknown;
      extraNotes?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId : "";
    const kind = (["soap", "dap", "progress"].includes(body.template as string)
      ? body.template
      : "soap") as NoteTemplateKind;

    const passed = Array.isArray(body.transcript) ? (body.transcript as TranscriptSegment[]) : null;
    const saved = appointmentId ? await getTranscript(appointmentId) : null;
    const segments = passed ?? (saved && saved.segments.length > 0 ? saved.segments : DEMO_SEGMENTS);

    await delay(); // simulated LLM latency
    const { bodyMd: generatedMd, summaryMd } = generatedNote(kind, segments);
    // Custom notes typed during the call ("Add notes" tab) are woven in as a
    // practitioner-addendum section so they reach the drafted note verbatim.
    const extraNotes = typeof body.extraNotes === "string" ? body.extraNotes.trim() : "";
    const bodyMd = extraNotes ? `${generatedMd}\n\n## Practitioner notes\n${extraNotes}` : generatedMd;
    const templateName = (await listTemplates()).find((t) => t.template === kind)?.name ?? "Note";
    const d = new Date();
    const title = `${templateName} ${d.getMonth() + 1}/${d.getDate()} — AI Scribe`;

    if (!appointmentId) return NextResponse.json({ title, bodyMd, summaryMd });

    // Persist the session transcript + summary, then file the draft note.
    await saveTranscript(appointmentId, segments, summaryMd);
    const clientId = await resolveClientId(
      appointmentId,
      typeof body.clientId === "string" ? body.clientId : null,
    );
    if (!clientId) return NextResponse.json({ title, bodyMd, summaryMd });

    const note = await createNote({ clientId, authorId: user.id, template: kind, title, bodyMd, appointmentId });
    await logEvent({
      actorId: user.id,
      action: "note.create",
      entity: "note",
      entityId: note.id,
      meta: { template: kind, clientId, via: "ai-scribe" },
    });
    return NextResponse.json({ note, title, bodyMd, summaryMd }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

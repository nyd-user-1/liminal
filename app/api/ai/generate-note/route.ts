import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
// Clinical domain — reads/writes the HIPAA-enabled project (see lib/db.ts).
import { hasPhiDb as hasDb, sqlPhi as sql } from "@/lib/db";
import { mockStore } from "@/lib/mock";
import { createNote, getTranscript, listNotes, listTemplates, saveTranscript } from "@/lib/repos/notes";
import type { NoteTemplateKind, TranscriptSegment } from "@/lib/types";
import { bedrockConfigured, clinicalComplete, parseJsonLoose } from "@/lib/ai/bedrock";
import { DEMO_SEGMENTS, delay, generatedNote } from "../demo-script";

export const dynamic = "force-dynamic";

const NOTE_HEADINGS: Record<NoteTemplateKind, string> = {
  soap: "SOAP format with sections: ## Subjective, ## Objective, ## Assessment, ## Plan",
  dap: "DAP format with sections: ## Data, ## Assessment, ## Plan",
  progress: "psychiatric progress-note format with sections: ## Interval history, ## Mental status, ## Assessment, ## Plan",
  intake: "psychiatric intake format with sections: ## Chief complaint, ## History of present illness, ## Psychiatric history, ## Assessment, ## Plan",
  free: "free-form clinical note using markdown headings where they aid clarity",
};

function noteSystem(kind: NoteTemplateKind): string {
  return `You are a clinical documentation assistant for a licensed New York psychiatry practice. Draft a session note in ${NOTE_HEADINGS[kind]}.
Rules: use ONLY information stated in the transcript and practitioner notes. Never invent diagnoses, medications, doses, scores, or findings. If a section has no supporting content, write "Not discussed." Write in concise clinical prose. Do not include the client's name.
Output ONLY minified JSON with two string keys: "bodyMd" (the full note in markdown) and "summaryMd" (a 1–2 sentence plain-text summary). No text outside the JSON.`;
}

/** Real Claude on Bedrock when configured; the canned demo draft otherwise.
 *  Throws when Bedrock IS configured but the call fails — the caller turns that
 *  into a 502 so a clinician never receives a fabricated note. */
async function draftNote(
  kind: NoteTemplateKind,
  segments: TranscriptSegment[],
): Promise<{ bodyMd: string; summaryMd: string }> {
  if (!bedrockConfigured()) {
    await delay(); // preserve the demo's simulated latency in stub mode
    return generatedNote(kind, segments);
  }
  const transcript = segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
  const { text } = await clinicalComplete({
    system: noteSystem(kind),
    user: `Session transcript:\n${transcript}\n\nReturn the JSON now.`,
    maxTokens: 1600,
  });
  const parsed = parseJsonLoose<{ bodyMd?: string; summaryMd?: string }>(text);
  if (parsed?.bodyMd) return { bodyMd: parsed.bodyMd, summaryMd: parsed.summaryMd ?? "" };
  // Model returned prose instead of JSON — use it as the note body rather than
  // failing; still a real, grounded completion.
  return { bodyMd: text, summaryMd: "" };
}

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

    let generatedMd: string;
    let summaryMd: string;
    try {
      ({ bodyMd: generatedMd, summaryMd } = await draftNote(kind, segments));
    } catch (err) {
      // Real Bedrock path failed (model access, throttling, network). Do NOT
      // fall back to canned clinical text — surface the failure instead.
      console.error("generate-note: Bedrock draft failed", (err as Error)?.name ?? "error");
      return NextResponse.json({ error: "Note generation is temporarily unavailable. Try again." }, { status: 502 });
    }
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

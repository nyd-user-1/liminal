import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";
import { mockId, mockStore } from "@/lib/mock";
import "@/lib/mock/notes";
import "@/lib/mock/clients"; // client fixtures — name joins work in mock mode regardless of sibling import order
import type {
  Note,
  NoteAmendment,
  NoteStatus,
  NoteTemplate,
  NoteTemplateKind,
  NoteWithAmendments,
  Transcript,
  TranscriptSegment,
} from "@/lib/types";

// Clinical documentation repo — notes, note templates, transcripts.
// hasDb → Postgres; otherwise the in-memory mock store (fixtures above).

type NoteRow = {
  id: string;
  client_id: string;
  appointment_id: string | null;
  author_id: string;
  template: NoteTemplateKind;
  title: string;
  body_md: string;
  status: NoteStatus;
  signed_at: string | Date | null;
  deleted_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toNote(r: NoteRow): Note {
  return {
    id: r.id,
    clientId: r.client_id,
    appointmentId: r.appointment_id,
    authorId: r.author_id,
    template: r.template,
    title: r.title,
    bodyMd: r.body_md,
    status: r.status,
    signedAt: isoDateTime(r.signed_at),
    deletedAt: isoDateTime(r.deleted_at),
    createdAt: isoDateTime(r.created_at),
    updatedAt: isoDateTime(r.updated_at),
  };
}

type TemplateRow = {
  id: string;
  name: string;
  template: NoteTemplateKind;
  body_md: string;
  is_builtin: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

function toTemplate(r: TemplateRow): NoteTemplate {
  return {
    id: r.id,
    name: r.name,
    template: r.template,
    bodyMd: r.body_md,
    isBuiltin: r.is_builtin,
    createdAt: isoDateTime(r.created_at),
    updatedAt: isoDateTime(r.updated_at),
  };
}

// ── notes ─────────────────────────────────────────────────────────────────────

export async function listNotes(f?: { clientId?: string; status?: NoteStatus }): Promise<Note[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT * FROM notes
      WHERE deleted_at IS NULL
        AND (${f?.clientId ?? null}::uuid IS NULL OR client_id = ${f?.clientId ?? null})
        AND (${f?.status ?? null}::text IS NULL OR status = ${f?.status ?? null})
      ORDER BY created_at DESC
    `) as NoteRow[];
    return rows.map(toNote);
  }
  return [...mockStore().notes.values()]
    .filter(
      (n) =>
        !n.deletedAt &&
        (!f?.clientId || n.clientId === f.clientId) &&
        (!f?.status || n.status === f.status),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getNote(id: string): Promise<Note | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM notes WHERE id = ${id} AND deleted_at IS NULL`) as NoteRow[];
    return rows[0] ? toNote(rows[0]) : null;
  }
  const n = mockStore().notes.get(id);
  return n && !n.deletedAt ? n : null;
}

export interface CreateNoteInput {
  clientId: string;
  authorId: string;
  template: NoteTemplateKind;
  title: string;
  bodyMd: string;
  appointmentId?: string | null;
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO notes (client_id, appointment_id, author_id, template, title, body_md, status)
      VALUES (${input.clientId}, ${input.appointmentId ?? null}, ${input.authorId}, ${input.template},
              ${input.title}, ${input.bodyMd}, 'draft')
      RETURNING *
    `) as NoteRow[];
    return toNote(rows[0]);
  }
  const now = new Date().toISOString();
  const note: Note = {
    id: mockId(),
    clientId: input.clientId,
    appointmentId: input.appointmentId ?? null,
    authorId: input.authorId,
    template: input.template,
    title: input.title,
    bodyMd: input.bodyMd,
    status: "draft",
    signedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  mockStore().notes.set(note.id, note);
  return note;
}

/** Thrown when a write targets a note that has been signed. Callers → HTTP 409. */
export class NoteLockedError extends Error {
  readonly status = 409;
  constructor(readonly noteId: string) {
    super("This note is signed. Corrections must be filed as an amendment.");
    this.name = "NoteLockedError";
  }
}

/** Signed notes are immutable — a signature is a legal attestation. Only
 *  drafts are editable; everything after signing is an appended amendment. */
export function isEditable(note: Note): boolean {
  return note.status === "draft";
}

export async function updateNote(id: string, patch: { title?: string; bodyMd?: string }): Promise<Note | null> {
  const existing = await getNote(id);
  if (!existing) return null;
  if (!isEditable(existing)) throw new NoteLockedError(id);
  const title = patch.title ?? existing.title;
  const bodyMd = patch.bodyMd ?? existing.bodyMd;
  if (hasDb) {
    const rows = (await sql`
      UPDATE notes SET title = ${title}, body_md = ${bodyMd}, updated_at = now()
      WHERE id = ${id} RETURNING *
    `) as NoteRow[];
    return rows[0] ? toNote(rows[0]) : null;
  }
  const next = { ...existing, title, bodyMd, updatedAt: new Date().toISOString() };
  mockStore().notes.set(id, next);
  return next;
}

/** draft → signed (stamps signed_at); signed → locked on second confirm. */
export async function signNote(id: string): Promise<Note | null> {
  const existing = await getNote(id);
  if (!existing || existing.status === "locked") return existing;
  const status: NoteStatus = existing.status === "draft" ? "signed" : "locked";
  const signedAt = existing.signedAt ?? new Date().toISOString();
  if (hasDb) {
    const rows = (await sql`
      UPDATE notes SET status = ${status}, signed_at = ${signedAt}, updated_at = now()
      WHERE id = ${id} RETURNING *
    `) as NoteRow[];
    return rows[0] ? toNote(rows[0]) : null;
  }
  const next = { ...existing, status, signedAt, updatedAt: new Date().toISOString() };
  mockStore().notes.set(id, next);
  return next;
}

/** Soft delete — clinical data is never hard-deleted. */
export async function deleteNote(id: string): Promise<boolean> {
  if (hasDb) {
    const rows = (await sql`
      UPDATE notes SET deleted_at = now(), updated_at = now()
      WHERE id = ${id} AND deleted_at IS NULL RETURNING id
    `) as Array<{ id: string }>;
    return rows.length > 0;
  }
  const n = mockStore().notes.get(id);
  if (!n || n.deletedAt) return false;
  mockStore().notes.set(id, { ...n, deletedAt: new Date().toISOString() });
  return true;
}

// ── amendments (append-only corrections to signed notes) ─────────────────────

export interface AddAmendmentInput {
  noteId: string;
  authorId: string;
  bodyMd: string;
}

/**
 * Append a correction to a note. Amendments are never edited or deleted — the
 * chain is the audit history. Returns null if the parent note does not exist.
 */
export async function addAmendment(_input: AddAmendmentInput): Promise<NoteAmendment | null> {
  throw new Error("addAmendment: not implemented yet (sql/062)");
}

/** Amendments for one note, oldest first (chronological correction chain). */
export async function listAmendments(_noteId: string): Promise<NoteAmendment[]> {
  throw new Error("listAmendments: not implemented yet (sql/062)");
}

/** Amendments for many notes, keyed by note id — list views without N+1. */
export async function listAmendmentsFor(_noteIds: string[]): Promise<Record<string, NoteAmendment[]>> {
  throw new Error("listAmendmentsFor: not implemented yet (sql/062)");
}

/** A note plus its correction chain — the full clinical record for one note. */
export async function getNoteWithAmendments(_id: string): Promise<NoteWithAmendments | null> {
  throw new Error("getNoteWithAmendments: not implemented yet (sql/062)");
}

// ── templates ─────────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<NoteTemplate[]> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM note_templates ORDER BY is_builtin DESC, name`) as TemplateRow[];
    return rows.map(toTemplate);
  }
  return [...mockStore().noteTemplates.values()].sort(
    (a, b) => Number(b.isBuiltin) - Number(a.isBuiltin) || a.name.localeCompare(b.name),
  );
}

export async function createTemplate(input: {
  name: string;
  template: NoteTemplateKind;
  bodyMd: string;
}): Promise<NoteTemplate> {
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO note_templates (name, template, body_md, is_builtin)
      VALUES (${input.name}, ${input.template}, ${input.bodyMd}, false)
      RETURNING *
    `) as TemplateRow[];
    return toTemplate(rows[0]);
  }
  const now = new Date().toISOString();
  const t: NoteTemplate = { id: mockId(), ...input, isBuiltin: false, createdAt: now, updatedAt: now };
  mockStore().noteTemplates.set(t.id, t);
  return t;
}

export async function updateTemplate(
  id: string,
  patch: { name?: string; bodyMd?: string },
): Promise<NoteTemplate | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM note_templates WHERE id = ${id}`) as TemplateRow[];
    if (!rows[0]) return null;
    const name = patch.name ?? rows[0].name;
    const bodyMd = patch.bodyMd ?? rows[0].body_md;
    const updated = (await sql`
      UPDATE note_templates SET name = ${name}, body_md = ${bodyMd}, updated_at = now()
      WHERE id = ${id} RETURNING *
    `) as TemplateRow[];
    return updated[0] ? toTemplate(updated[0]) : null;
  }
  const t = mockStore().noteTemplates.get(id);
  if (!t) return null;
  const next = {
    ...t,
    name: patch.name ?? t.name,
    bodyMd: patch.bodyMd ?? t.bodyMd,
    updatedAt: new Date().toISOString(),
  };
  mockStore().noteTemplates.set(id, next);
  return next;
}

// ── transcripts ───────────────────────────────────────────────────────────────

export async function getTranscript(appointmentId: string): Promise<Transcript | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM transcripts WHERE appointment_id = ${appointmentId}`) as Array<{
      id: string;
      appointment_id: string;
      segments: Transcript["segments"];
      summary_md: string | null;
      status: Transcript["status"];
      created_at: string | Date;
      updated_at: string | Date;
    }>;
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      appointmentId: r.appointment_id,
      segments: r.segments,
      summaryMd: r.summary_md,
      status: r.status,
      createdAt: isoDateTime(r.created_at),
      updatedAt: isoDateTime(r.updated_at),
    };
  }
  return [...mockStore().transcripts.values()].find((t) => t.appointmentId === appointmentId) ?? null;
}

/** Upsert the transcript for an appointment (scribe end-of-session save). */
export async function saveTranscript(
  appointmentId: string,
  segments: TranscriptSegment[],
  summaryMd: string | null,
): Promise<Transcript> {
  const existing = await getTranscript(appointmentId);
  if (hasDb) {
    const rows = existing
      ? ((await sql`
          UPDATE transcripts SET segments = ${JSON.stringify(segments)}, summary_md = ${summaryMd},
            status = 'ready', updated_at = now()
          WHERE id = ${existing.id} RETURNING *
        `) as Array<Record<string, unknown>>)
      : ((await sql`
          INSERT INTO transcripts (appointment_id, segments, summary_md, status)
          VALUES (${appointmentId}, ${JSON.stringify(segments)}, ${summaryMd}, 'ready')
          RETURNING *
        `) as Array<Record<string, unknown>>);
    const r = rows[0] as {
      id: string;
      appointment_id: string;
      segments: TranscriptSegment[];
      summary_md: string | null;
      status: Transcript["status"];
      created_at: string | Date;
      updated_at: string | Date;
    };
    return {
      id: r.id,
      appointmentId: r.appointment_id,
      segments: r.segments,
      summaryMd: r.summary_md,
      status: r.status,
      createdAt: isoDateTime(r.created_at),
      updatedAt: isoDateTime(r.updated_at),
    };
  }
  const now = new Date().toISOString();
  const t: Transcript = {
    id: existing?.id ?? mockId(),
    appointmentId,
    segments,
    summaryMd,
    status: "ready",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  mockStore().transcripts.set(t.id, t);
  return t;
}

// ── name joins (display helpers — ids in, names out; no PHI beyond names) ─────

/** Author display names for a set of notes (mock: users map; DB: users table). */
export async function authorNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  if (hasDb) {
    const rows = (await sql`SELECT id, name FROM users WHERE id = ANY(${unique})`) as Array<{
      id: string;
      name: string;
    }>;
    return Object.fromEntries(rows.map((r) => [r.id, r.name]));
  }
  const users = mockStore().users;
  return Object.fromEntries(unique.map((id) => [id, users.get(id)?.name ?? "Practitioner"]));
}

/** Client display names by id. */
export async function clientNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  if (hasDb) {
    const rows = (await sql`
      SELECT id, first_name, last_name FROM clients WHERE id = ANY(${unique})
    `) as Array<{ id: string; first_name: string; last_name: string }>;
    return Object.fromEntries(rows.map((r) => [r.id, `${r.first_name} ${r.last_name}`]));
  }
  const clients = mockStore().clients;
  return Object.fromEntries(
    unique.map((id) => {
      const c = clients.get(id);
      return [id, c ? `${c.firstName} ${c.lastName}` : "Client"];
    }),
  );
}

/** Active clients as {id, name} options — the "Use template" client picker. */
export async function listClientOptions(): Promise<Array<{ id: string; name: string }>> {
  if (hasDb) {
    const rows = (await sql`
      SELECT id, first_name, last_name FROM clients WHERE status = 'active' ORDER BY first_name, last_name
    `) as Array<{ id: string; first_name: string; last_name: string }>;
    return rows.map((r) => ({ id: r.id, name: `${r.first_name} ${r.last_name}` }));
  }
  return [...mockStore().clients.values()]
    .filter((c) => c.status === "active")
    .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

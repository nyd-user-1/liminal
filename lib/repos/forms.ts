import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";
import { mockId, mockStore } from "@/lib/mock";
import "@/lib/mock/forms";
import "@/lib/mock/clients";
import { createThread, listThreads, postMessage } from "@/lib/repos/threads";
import type { Form, FormBlock, FormResponse, FormResponseStatus, FormStatus } from "@/lib/types";

// Forms repo — form templates (JSONB block schema) + client responses.
// hasDb → Postgres (schema column stores {"blocks":[…]}); otherwise the
// in-memory mock store.

type FormRow = {
  id: string;
  title: string;
  description: string | null;
  schema: { blocks?: FormBlock[] } | FormBlock[];
  status: FormStatus;
  created_at: string | Date;
  updated_at: string | Date;
};

function toForm(r: FormRow): Form {
  const schema = Array.isArray(r.schema) ? r.schema : (r.schema?.blocks ?? []);
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    schema,
    status: r.status,
    createdAt: isoDateTime(r.created_at),
    updatedAt: isoDateTime(r.updated_at),
  };
}

type ResponseRow = {
  id: string;
  form_id: string;
  client_id: string;
  answers: Record<string, unknown>;
  status: FormResponseStatus;
  submitted_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toResponse(r: ResponseRow): FormResponse {
  return {
    id: r.id,
    formId: r.form_id,
    clientId: r.client_id,
    answers: r.answers ?? {},
    status: r.status,
    submittedAt: isoDateTime(r.submitted_at),
    createdAt: isoDateTime(r.created_at),
    updatedAt: isoDateTime(r.updated_at),
  };
}

// ── forms ─────────────────────────────────────────────────────────────────────

export async function listForms(): Promise<Array<Form & { responseCount: number }>> {
  if (hasDb) {
    const rows = (await sql`
      SELECT f.*, (SELECT count(*)::int FROM form_responses r WHERE r.form_id = f.id) AS response_count
      FROM forms f ORDER BY f.created_at DESC
    `) as Array<FormRow & { response_count: number }>;
    return rows.map((r) => ({ ...toForm(r), responseCount: r.response_count }));
  }
  const store = mockStore();
  const responses = [...store.formResponses.values()];
  return [...store.forms.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((f) => ({ ...f, responseCount: responses.filter((r) => r.formId === f.id).length }));
}

export async function getForm(id: string): Promise<Form | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM forms WHERE id = ${id}`) as FormRow[];
    return rows[0] ? toForm(rows[0]) : null;
  }
  return mockStore().forms.get(id) ?? null;
}

export interface SaveFormInput {
  id?: string;
  title: string;
  description?: string | null;
  schema: FormBlock[];
  status?: FormStatus;
}

/** Create (no id) or update (id) a form template. */
export async function saveForm(input: SaveFormInput): Promise<Form> {
  const description = input.description ?? null;
  const status = input.status ?? "draft";
  if (hasDb) {
    const schemaJson = JSON.stringify({ blocks: input.schema });
    if (input.id) {
      const rows = (await sql`
        UPDATE forms SET title = ${input.title}, description = ${description},
          schema = ${schemaJson}::jsonb, status = ${status}, updated_at = now()
        WHERE id = ${input.id} RETURNING *
      `) as FormRow[];
      if (!rows[0]) throw new Error("Form not found");
      return toForm(rows[0]);
    }
    const rows = (await sql`
      INSERT INTO forms (title, description, schema, status)
      VALUES (${input.title}, ${description}, ${schemaJson}::jsonb, ${status})
      RETURNING *
    `) as FormRow[];
    return toForm(rows[0]);
  }
  const store = mockStore();
  const now = new Date().toISOString();
  if (input.id) {
    const existing = store.forms.get(input.id);
    if (!existing) throw new Error("Form not found");
    const next: Form = { ...existing, title: input.title, description, schema: input.schema, status, updatedAt: now };
    store.forms.set(next.id, next);
    return next;
  }
  const form: Form = {
    id: mockId(),
    title: input.title,
    description,
    schema: input.schema,
    status,
    createdAt: now,
    updatedAt: now,
  };
  store.forms.set(form.id, form);
  return form;
}

/** Delete a form template and any responses to it. Returns false if missing. */
export async function deleteForm(id: string): Promise<boolean> {
  if (hasDb) {
    // Remove responses first in case the FK isn't ON DELETE CASCADE.
    await sql`DELETE FROM form_responses WHERE form_id = ${id}`;
    const rows = (await sql`DELETE FROM forms WHERE id = ${id} RETURNING id`) as Array<{ id: string }>;
    return rows.length > 0;
  }
  const store = mockStore();
  if (!store.forms.has(id)) return false;
  store.forms.delete(id);
  for (const [rid, r] of store.formResponses) {
    if (r.formId === id) store.formResponses.delete(rid);
  }
  return true;
}

// ── responses ─────────────────────────────────────────────────────────────────

export interface ResponseSummary extends FormResponse {
  formTitle: string;
  formDescription: string | null;
  clientName: string;
}

export async function listResponses(f?: { clientId?: string; formId?: string }): Promise<ResponseSummary[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT r.*, fm.title AS form_title, fm.description AS form_description,
             c.first_name, c.last_name
      FROM form_responses r
        JOIN forms fm ON fm.id = r.form_id
        JOIN clients c ON c.id = r.client_id
      WHERE (${f?.clientId ?? null}::uuid IS NULL OR r.client_id = ${f?.clientId ?? null})
        AND (${f?.formId ?? null}::uuid IS NULL OR r.form_id = ${f?.formId ?? null})
      ORDER BY r.created_at DESC
    `) as Array<ResponseRow & { form_title: string; form_description: string | null; first_name: string; last_name: string }>;
    return rows.map((r) => ({
      ...toResponse(r),
      formTitle: r.form_title,
      formDescription: r.form_description,
      clientName: `${r.first_name} ${r.last_name}`,
    }));
  }
  const store = mockStore();
  return [...store.formResponses.values()]
    .filter((r) => (!f?.clientId || r.clientId === f.clientId) && (!f?.formId || r.formId === f.formId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const form = store.forms.get(r.formId);
      const client = store.clients.get(r.clientId);
      return {
        ...r,
        formTitle: form?.title ?? "Form",
        formDescription: form?.description ?? null,
        clientName: client ? `${client.firstName} ${client.lastName}` : "Client",
      };
    });
}

export async function getResponse(id: string): Promise<FormResponse | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM form_responses WHERE id = ${id}`) as ResponseRow[];
    return rows[0] ? toResponse(rows[0]) : null;
  }
  return mockStore().formResponses.get(id) ?? null;
}

/**
 * Send a form to a client: creates a form_response (status `sent`) and drops
 * a message with the portal link into the client's open thread (creating a
 * thread when none exists). `senderId` defaults to the client's primary
 * practitioner so the contract call sendForm(formId, clientId) works alone.
 */
export async function sendForm(formId: string, clientId: string, senderId?: string): Promise<FormResponse> {
  const form = await getForm(formId);
  if (!form) throw new Error("Form not found");

  let response: FormResponse;
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO form_responses (form_id, client_id, answers, status)
      VALUES (${formId}, ${clientId}, '{}'::jsonb, 'sent')
      RETURNING *
    `) as ResponseRow[];
    response = toResponse(rows[0]);
  } else {
    const now = new Date().toISOString();
    response = {
      id: mockId(),
      formId,
      clientId,
      answers: {},
      status: "sent",
      submittedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    mockStore().formResponses.set(response.id, response);
  }

  let sender = senderId ?? null;
  if (!sender) {
    if (hasDb) {
      const rows = (await sql`SELECT primary_practitioner_id FROM clients WHERE id = ${clientId}`) as Array<{ primary_practitioner_id: string | null }>;
      sender = rows[0]?.primary_practitioner_id ?? null;
    } else {
      sender = mockStore().clients.get(clientId)?.primaryPractitionerId ?? null;
    }
  }
  if (sender) {
    const body = `Please complete "${form.title}" before your next visit. Open it in your portal: /portal/forms/${response.id}`;
    const open = (await listThreads({ clientId, status: "open" }))[0];
    if (open) await postMessage(open.id, sender, body);
    else await createThread({ clientId, subject: `Form to complete: ${form.title}`, senderId: sender, body });
  }
  return response;
}

/** Save partial answers (portal "Save progress") — status → in_progress. */
export async function saveResponseProgress(id: string, answers: Record<string, unknown>): Promise<FormResponse | null> {
  const existing = await getResponse(id);
  if (!existing || existing.status === "submitted") return existing;
  if (hasDb) {
    const rows = (await sql`
      UPDATE form_responses SET answers = ${JSON.stringify(answers)}::jsonb, status = 'in_progress', updated_at = now()
      WHERE id = ${id} RETURNING *
    `) as ResponseRow[];
    return rows[0] ? toResponse(rows[0]) : null;
  }
  const next: FormResponse = { ...existing, answers, status: "in_progress", updatedAt: new Date().toISOString() };
  mockStore().formResponses.set(id, next);
  return next;
}

/**
 * Final submission: persists answers, stamps submitted_at, and posts a
 * notification message into the client's thread (from the portal user) so
 * the practitioner inbox surfaces it.
 */
export async function submitResponse(id: string, answers: Record<string, unknown>): Promise<FormResponse | null> {
  const existing = await getResponse(id);
  if (!existing) return null;
  if (existing.status === "submitted") return existing;

  const submittedAt = new Date().toISOString();
  let next: FormResponse;
  if (hasDb) {
    const rows = (await sql`
      UPDATE form_responses SET answers = ${JSON.stringify(answers)}::jsonb, status = 'submitted',
        submitted_at = ${submittedAt}, updated_at = now()
      WHERE id = ${id} RETURNING *
    `) as ResponseRow[];
    if (!rows[0]) return null;
    next = toResponse(rows[0]);
  } else {
    next = { ...existing, answers, status: "submitted", submittedAt, updatedAt: submittedAt };
    mockStore().formResponses.set(id, next);
  }

  // Thread notification — sent as the client's portal user when one exists.
  const form = await getForm(next.formId);
  let clientUserId: string | null;
  if (hasDb) {
    const rows = (await sql`SELECT user_id FROM clients WHERE id = ${next.clientId}`) as Array<{ user_id: string | null }>;
    clientUserId = rows[0]?.user_id ?? null;
  } else {
    clientUserId = mockStore().clients.get(next.clientId)?.userId ?? null;
  }
  if (clientUserId) {
    const body = `Submitted "${form?.title ?? "a form"}" — responses are ready to review.`;
    const open = (await listThreads({ clientId: next.clientId, status: "open" }))[0];
    if (open) await postMessage(open.id, clientUserId, body);
    else await createThread({ clientId: next.clientId, subject: `Form submitted: ${form?.title ?? "Form"}`, senderId: clientUserId, body });
  }
  return next;
}

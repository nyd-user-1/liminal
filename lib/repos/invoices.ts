import { hasDb, sql } from "@/lib/db";
import { isoDateOnly, isoDateTime } from "@/lib/format";
import { mockId, mockStore } from "@/lib/mock";
import "@/lib/mock/invoices";
import "@/lib/mock/clients";
import type { Client, Invoice, InvoiceItem, InvoiceStatus, Payment, PaymentMethod } from "@/lib/types";

// Billing repo — invoices, invoice items, payments. hasDb → Postgres;
// otherwise the in-memory mock store (fixtures mirror sql/002_seed.sql).

type InvoiceRow = {
  id: string;
  number: string;
  client_id: string;
  appointment_id: string | null;
  status: InvoiceStatus;
  issued_on: string | Date | null;
  due_on: string | Date | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  stripe_checkout_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  client_name?: string;
};

function toInvoice(r: InvoiceRow): Invoice {
  return {
    id: r.id,
    number: r.number,
    clientId: r.client_id,
    appointmentId: r.appointment_id,
    status: r.status,
    issuedOn: isoDateOnly(r.issued_on),
    dueOn: isoDateOnly(r.due_on),
    subtotalCents: r.subtotal_cents,
    taxCents: r.tax_cents,
    totalCents: r.total_cents,
    stripeCheckoutId: r.stripe_checkout_id,
    createdAt: isoDateTime(r.created_at),
    updatedAt: isoDateTime(r.updated_at),
  };
}

export interface InvoiceListItem extends Invoice {
  clientName: string;
  paidCents: number;
  balanceCents: number;
}

export interface InvoiceDetail extends InvoiceListItem {
  client: Client | null;
  items: InvoiceItem[];
  payments: Payment[];
}

function mockClientName(clientId: string): string {
  const c = mockStore().clients.get(clientId);
  return c ? `${c.firstName} ${c.lastName}` : "Unknown client";
}

// ── invoices ──────────────────────────────────────────────────────────────────

export async function listInvoices(f?: {
  clientId?: string;
  status?: InvoiceStatus;
}): Promise<InvoiceListItem[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT i.*, (c.first_name || ' ' || c.last_name) AS client_name,
             COALESCE(p.paid, 0)::int AS paid_cents
      FROM invoices i
      JOIN clients c ON c.id = i.client_id
      LEFT JOIN (SELECT invoice_id, SUM(amount_cents) AS paid FROM payments GROUP BY invoice_id) p
        ON p.invoice_id = i.id
      WHERE (${f?.clientId ?? null}::uuid IS NULL OR i.client_id = ${f?.clientId ?? null})
        AND (${f?.status ?? null}::text IS NULL OR i.status = ${f?.status ?? null})
      ORDER BY i.number DESC
    `) as Array<InvoiceRow & { paid_cents: number }>;
    return rows.map((r) => {
      const inv = toInvoice(r);
      const paidCents = Number(r.paid_cents ?? 0);
      return {
        ...inv,
        clientName: r.client_name ?? "Unknown client",
        paidCents,
        balanceCents: Math.max(inv.totalCents - paidCents, 0),
      };
    });
  }
  const payments = [...mockStore().payments.values()];
  return [...mockStore().invoices.values()]
    .filter((i) => (!f?.clientId || i.clientId === f.clientId) && (!f?.status || i.status === f.status))
    .sort((a, b) => b.number.localeCompare(a.number))
    .map((i) => {
      const paidCents = payments.filter((p) => p.invoiceId === i.id).reduce((s, p) => s + p.amountCents, 0);
      return {
        ...i,
        clientName: mockClientName(i.clientId),
        paidCents,
        balanceCents: Math.max(i.totalCents - paidCents, 0),
      };
    });
}

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  let invoice: Invoice | null = null;
  let client: Client | null = null;
  let items: InvoiceItem[] = [];
  let payments: Payment[] = [];

  if (hasDb) {
    const rows = (await sql`SELECT * FROM invoices WHERE id = ${id}`) as InvoiceRow[];
    if (!rows[0]) return null;
    invoice = toInvoice(rows[0]);
    const clientRows = (await sql`SELECT * FROM clients WHERE id = ${invoice.clientId}`) as Array<{
      id: string;
      user_id: string | null;
      first_name: string;
      last_name: string;
      dob: string | Date | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      gender: string | null;
      pronouns: string | null;
      status: Client["status"];
      tags: string[];
      primary_practitioner_id: string | null;
      photon_patient_id: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>;
    const c = clientRows[0];
    client = c
      ? {
          id: c.id,
          userId: c.user_id,
          firstName: c.first_name,
          lastName: c.last_name,
          dob: isoDateOnly(c.dob),
          email: c.email,
          phone: c.phone,
          address: c.address,
          gender: c.gender,
          pronouns: c.pronouns,
          status: c.status,
          tags: c.tags,
          primaryPractitionerId: c.primary_practitioner_id,
          photonPatientId: c.photon_patient_id,
          createdAt: isoDateTime(c.created_at),
          updatedAt: isoDateTime(c.updated_at),
        }
      : null;
    const itemRows = (await sql`
      SELECT id, invoice_id, description, qty, unit_cents, amount_cents
      FROM invoice_items WHERE invoice_id = ${id} ORDER BY id
    `) as Array<{ id: string; invoice_id: string; description: string; qty: number; unit_cents: number; amount_cents: number }>;
    items = itemRows.map((r) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      description: r.description,
      qty: r.qty,
      unitCents: r.unit_cents,
      amountCents: r.amount_cents,
    }));
    const payRows = (await sql`
      SELECT id, invoice_id, amount_cents, method, stripe_payment_intent, paid_at, created_at
      FROM payments WHERE invoice_id = ${id} ORDER BY paid_at
    `) as Array<{ id: string; invoice_id: string; amount_cents: number; method: PaymentMethod; stripe_payment_intent: string | null; paid_at: string | Date; created_at: string | Date }>;
    payments = payRows.map((r) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      amountCents: r.amount_cents,
      method: r.method,
      stripePaymentIntent: r.stripe_payment_intent,
      paidAt: isoDateTime(r.paid_at),
      createdAt: isoDateTime(r.created_at),
    }));
  } else {
    const store = mockStore();
    invoice = store.invoices.get(id) ?? null;
    if (!invoice) return null;
    client = store.clients.get(invoice.clientId) ?? null;
    items = [...store.invoiceItems.values()].filter((it) => it.invoiceId === id).sort((a, b) => a.id.localeCompare(b.id));
    payments = [...store.payments.values()].filter((p) => p.invoiceId === id).sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  }

  const paidCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  return {
    ...invoice,
    clientName: client ? `${client.firstName} ${client.lastName}` : "Unknown client",
    client,
    items,
    payments,
    paidCents,
    balanceCents: Math.max(invoice.totalCents - paidCents, 0),
  };
}

export interface CreateInvoiceInput {
  clientId: string;
  appointmentId?: string | null;
  issuedOn?: string | null; // YYYY-MM-DD, defaults to today
  dueOn?: string | null;
  status?: "draft" | "sent";
  items: Array<{ description: string; qty: number; unitCents: number }>;
}

async function nextInvoiceNumber(): Promise<string> {
  let max = 0;
  if (hasDb) {
    const rows = (await sql`
      SELECT COALESCE(MAX(SUBSTRING(number FROM 10)::int), 0) AS max FROM invoices WHERE number LIKE 'INV-2026-%'
    `) as Array<{ max: number }>;
    max = rows[0]?.max ?? 0;
  } else {
    for (const i of mockStore().invoices.values()) {
      const m = /^INV-2026-(\d+)$/.exec(i.number);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `INV-2026-${String(max + 1).padStart(4, "0")}`;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDetail> {
  const number = await nextInvoiceNumber();
  const issuedOn = input.issuedOn ?? new Date().toISOString().slice(0, 10);
  const status = input.status ?? "draft";
  const items = input.items.map((it) => ({ ...it, amountCents: it.qty * it.unitCents }));
  const subtotalCents = items.reduce((sum, it) => sum + it.amountCents, 0);

  if (hasDb) {
    const rows = (await sql`
      INSERT INTO invoices (number, client_id, appointment_id, status, issued_on, due_on, subtotal_cents, tax_cents, total_cents)
      VALUES (${number}, ${input.clientId}, ${input.appointmentId ?? null}, ${status}, ${issuedOn},
              ${input.dueOn ?? null}, ${subtotalCents}, 0, ${subtotalCents})
      RETURNING *
    `) as InvoiceRow[];
    const inv = toInvoice(rows[0]);
    for (const it of items) {
      await sql`
        INSERT INTO invoice_items (invoice_id, description, qty, unit_cents, amount_cents)
        VALUES (${inv.id}, ${it.description}, ${it.qty}, ${it.unitCents}, ${it.amountCents})
      `;
    }
    return (await getInvoice(inv.id))!;
  }

  const now = new Date().toISOString();
  const invoice: Invoice = {
    id: mockId(),
    number,
    clientId: input.clientId,
    appointmentId: input.appointmentId ?? null,
    status,
    issuedOn,
    dueOn: input.dueOn ?? null,
    subtotalCents,
    taxCents: 0,
    totalCents: subtotalCents,
    stripeCheckoutId: null,
    createdAt: now,
    updatedAt: now,
  };
  const store = mockStore();
  store.invoices.set(invoice.id, invoice);
  for (const it of items) {
    const row: InvoiceItem = { id: mockId(), invoiceId: invoice.id, ...it };
    store.invoiceItems.set(row.id, row);
  }
  return (await getInvoice(invoice.id))!;
}

export interface UpdateInvoicePatch {
  status?: InvoiceStatus;
  issuedOn?: string | null;
  dueOn?: string | null;
  stripeCheckoutId?: string | null;
}

export async function updateInvoice(id: string, patch: UpdateInvoicePatch): Promise<InvoiceDetail | null> {
  const existing = await getInvoice(id);
  if (!existing) return null;
  const status = patch.status ?? existing.status;
  const issuedOn = patch.issuedOn !== undefined ? patch.issuedOn : existing.issuedOn;
  const dueOn = patch.dueOn !== undefined ? patch.dueOn : existing.dueOn;
  const stripeCheckoutId =
    patch.stripeCheckoutId !== undefined ? patch.stripeCheckoutId : existing.stripeCheckoutId;

  if (hasDb) {
    await sql`
      UPDATE invoices
      SET status = ${status}, issued_on = ${issuedOn}, due_on = ${dueOn},
          stripe_checkout_id = ${stripeCheckoutId}, updated_at = now()
      WHERE id = ${id}
    `;
    return getInvoice(id);
  }
  const store = mockStore();
  const inv = store.invoices.get(id)!;
  store.invoices.set(id, { ...inv, status, issuedOn, dueOn, stripeCheckoutId, updatedAt: new Date().toISOString() });
  return getInvoice(id);
}

// ── payments ──────────────────────────────────────────────────────────────────

export async function recordPayment(
  invoiceId: string,
  input: { amountCents: number; method: PaymentMethod; stripePaymentIntent?: string | null },
): Promise<{ payment: Payment; invoice: InvoiceDetail } | null> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return null;

  const paidAt = new Date().toISOString();
  let payment: Payment;
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO payments (invoice_id, amount_cents, method, stripe_payment_intent, paid_at)
      VALUES (${invoiceId}, ${input.amountCents}, ${input.method}, ${input.stripePaymentIntent ?? null}, ${paidAt})
      RETURNING id, invoice_id, amount_cents, method, stripe_payment_intent, paid_at, created_at
    `) as Array<{ id: string; invoice_id: string; amount_cents: number; method: PaymentMethod; stripe_payment_intent: string | null; paid_at: string | Date; created_at: string | Date }>;
    const r = rows[0];
    payment = {
      id: r.id,
      invoiceId: r.invoice_id,
      amountCents: r.amount_cents,
      method: r.method,
      stripePaymentIntent: r.stripe_payment_intent,
      paidAt: isoDateTime(r.paid_at),
      createdAt: isoDateTime(r.created_at),
    };
  } else {
    payment = {
      id: mockId(),
      invoiceId,
      amountCents: input.amountCents,
      method: input.method,
      stripePaymentIntent: input.stripePaymentIntent ?? null,
      paidAt,
      createdAt: paidAt,
    };
    mockStore().payments.set(payment.id, payment);
  }

  // Settle: once payments cover the total, the invoice flips to paid.
  const paidTotal = invoice.paidCents + input.amountCents;
  if (invoice.status !== "void" && paidTotal >= invoice.totalCents) {
    await updateInvoice(invoiceId, { status: "paid" });
  }
  return { payment, invoice: (await getInvoice(invoiceId))! };
}

// ── stats ─────────────────────────────────────────────────────────────────────

export interface InvoiceStats {
  outstandingCents: number;
  paidThisMonthCents: number;
  overdueCount: number;
  draftCount: number;
}

export async function invoiceStats(): Promise<InvoiceStats> {
  if (hasDb) {
    const [outRes, paidRes, countRes] = await Promise.all([
      sql`
        SELECT COALESCE(SUM(i.total_cents - COALESCE(p.paid, 0)), 0) AS outstanding
        FROM invoices i
        LEFT JOIN (SELECT invoice_id, SUM(amount_cents) AS paid FROM payments GROUP BY invoice_id) p
          ON p.invoice_id = i.id
        WHERE i.status IN ('sent', 'overdue')
      `,
      sql`
        SELECT COALESCE(SUM(amount_cents), 0) AS paid FROM payments
        WHERE date_trunc('month', paid_at) = date_trunc('month', now())
      `,
      sql`
        SELECT COUNT(*) FILTER (WHERE status = 'overdue') AS overdue,
               COUNT(*) FILTER (WHERE status = 'draft') AS draft
        FROM invoices
      `,
    ]);
    const outRows = outRes as Array<{ outstanding: number }>;
    const paidRows = paidRes as Array<{ paid: number }>;
    const countRows = countRes as Array<{ overdue: number; draft: number }>;
    return {
      outstandingCents: Number(outRows[0]?.outstanding ?? 0),
      paidThisMonthCents: Number(paidRows[0]?.paid ?? 0),
      overdueCount: Number(countRows[0]?.overdue ?? 0),
      draftCount: Number(countRows[0]?.draft ?? 0),
    };
  }

  const store = mockStore();
  const invoices = [...store.invoices.values()];
  const payments = [...store.payments.values()];
  const paidFor = (invoiceId: string) =>
    payments.filter((p) => p.invoiceId === invoiceId).reduce((s, p) => s + p.amountCents, 0);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    outstandingCents: invoices
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((s, i) => s + Math.max(i.totalCents - paidFor(i.id), 0), 0),
    paidThisMonthCents: payments
      .filter((p) => new Date(p.paidAt).toISOString().slice(0, 7) === monthKey)
      .reduce((s, p) => s + p.amountCents, 0),
    overdueCount: invoices.filter((i) => i.status === "overdue").length,
    draftCount: invoices.filter((i) => i.status === "draft").length,
  };
}

/** Per-client billing summary — powers the client Billing tab StatCards. */
export async function clientBillingSummary(clientId: string): Promise<{
  balanceCents: number;
  lastPaymentCents: number | null;
  lastPaymentAt: string | null;
}> {
  const invoices = await listInvoices({ clientId });
  let balanceCents = 0;
  let last: Payment | null = null;
  for (const inv of invoices) {
    const detail = await getInvoice(inv.id);
    if (!detail) continue;
    if (inv.status === "sent" || inv.status === "overdue") balanceCents += detail.balanceCents;
    for (const p of detail.payments) {
      if (!last || p.paidAt > last.paidAt) last = p;
    }
  }
  return {
    balanceCents,
    lastPaymentCents: last?.amountCents ?? null,
    lastPaymentAt: last?.paidAt ?? null,
  };
}

/** id + display name for the invoice client picker (non-archived clients). */
export async function listClientOptions(): Promise<Array<{ id: string; name: string }>> {
  if (hasDb) {
    const rows = (await sql`
      SELECT id, (first_name || ' ' || last_name) AS name
      FROM clients WHERE status != 'archived' ORDER BY first_name, last_name
    `) as Array<{ id: string; name: string }>;
    return rows;
  }
  return [...mockStore().clients.values()]
    .filter((c) => c.status !== "archived")
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
    .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));
}

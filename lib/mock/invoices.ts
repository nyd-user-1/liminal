import { registerFixtures } from "@/lib/mock";
import type { Invoice, InvoiceItem, InvoiceStatus, Payment, PaymentMethod } from "@/lib/types";

// Billing fixtures — mirrors sql/002_seed.sql invoices (14) + invoice_items
// (15) + payments (16): same uuids, numbers, amounts, dates.

const T = "2026-06-01T09:00:00.000Z";

const C = (nn: string) => `00000000-0000-4000-8000-0000000020${nn}`; // client
const A = (nn: string) => `00000000-0000-4000-8000-0000000060${nn}`; // appointment
const INV = (nn: string) => `00000000-0000-4000-8000-0000000140${nn}`;
const ITEM = (nn: string) => `00000000-0000-4000-8000-0000000150${nn}`;
const PAY = (nn: string) => `00000000-0000-4000-8000-0000000160${nn}`;

function inv(
  nn: string,
  number: string,
  clientId: string,
  appointmentId: string | null,
  status: InvoiceStatus,
  issuedOn: string | null,
  dueOn: string | null,
  totalCents: number,
  stripeCheckoutId: string | null,
): Invoice {
  return {
    id: INV(nn),
    number,
    clientId,
    appointmentId,
    status,
    issuedOn,
    dueOn,
    subtotalCents: totalCents,
    taxCents: 0,
    totalCents,
    stripeCheckoutId,
    createdAt: T,
    updatedAt: T,
  };
}

const invoices: Invoice[] = [
  inv("01", "INV-2026-0001", C("02"), A("01"), "paid", "2026-06-22", "2026-07-06", 12500, "cs_test_demo_0001"),
  inv("02", "INV-2026-0002", C("03"), A("02"), "paid", "2026-06-22", "2026-07-06", 17500, "cs_test_demo_0002"),
  inv("03", "INV-2026-0003", C("04"), A("07"), "paid", "2026-06-29", "2026-07-13", 17500, null),
  inv("04", "INV-2026-0004", C("01"), A("09"), "sent", "2026-07-01", "2026-07-15", 12500, null),
  inv("05", "INV-2026-0005", C("05"), A("05"), "overdue", "2026-06-25", "2026-07-02", 12500, null),
  inv("06", "INV-2026-0006", C("06"), A("08"), "paid", "2026-06-29", "2026-07-13", 12500, "cs_test_demo_0006"),
  inv("07", "INV-2026-0007", C("07"), A("10"), "sent", "2026-07-01", "2026-07-15", 17500, null),
  inv("08", "INV-2026-0008", C("08"), null, "overdue", "2026-06-10", "2026-06-24", 17500, null),
  inv("09", "INV-2026-0009", C("02"), A("13"), "draft", "2026-07-03", null, 25000, null),
  inv("10", "INV-2026-0010", C("11"), null, "void", "2026-05-12", "2026-05-26", 25000, null),
];

function item(nn: string, invNn: string, description: string, qty: number, unitCents: number): InvoiceItem {
  return { id: ITEM(nn), invoiceId: INV(invNn), description, qty, unitCents, amountCents: qty * unitCents };
}

const items: InvoiceItem[] = [
  item("01", "01", "Follow-up (30 min) — 6/22/2026", 1, 12500),
  item("02", "02", "Therapy (45 min) — 6/22/2026", 1, 17500),
  item("03", "03", "Therapy (45 min) — 6/29/2026", 1, 17500),
  item("04", "04", "Follow-up (30 min) — 6/30/2026", 1, 12500),
  item("05", "05", "Follow-up (30 min) — 6/25/2026", 1, 12500),
  item("06", "06", "Follow-up (30 min) — 6/29/2026", 1, 12500),
  item("07", "07", "Therapy (45 min) — 6/30/2026", 1, 17500),
  item("08", "08", "Telehealth Check-in (20 min) — 6/3/2026", 1, 7500),
  item("09", "08", "Therapy (45 min, sliding scale) — 6/9/2026", 1, 10000),
  item("10", "09", "Therapy (45 min) — 7/2/2026", 1, 17500),
  item("11", "09", "Telehealth Check-in (20 min) — 7/2/2026", 1, 7500),
  item("12", "10", "Initial Evaluation (60 min) — 5/12/2026", 1, 25000),
];

function pay(
  nn: string,
  invNn: string,
  amountCents: number,
  method: PaymentMethod,
  stripePaymentIntent: string | null,
  paidAt: string,
): Payment {
  return { id: PAY(nn), invoiceId: INV(invNn), amountCents, method, stripePaymentIntent, paidAt, createdAt: paidAt };
}

const payments: Payment[] = [
  pay("01", "01", 12500, "card", "pi_demo_0001", "2026-06-23T08:12:00-04:00"),
  pay("02", "02", 17500, "card", "pi_demo_0002", "2026-06-24T17:31:00-04:00"),
  pay("03", "03", 17500, "insurance", null, "2026-07-02T10:00:00-04:00"),
  pay("04", "06", 12500, "card", "pi_demo_0006", "2026-06-30T12:05:00-04:00"),
  pay("05", "05", 5000, "cash", null, "2026-07-01T09:00:00-04:00"),
];

registerFixtures("invoices", (store) => {
  for (const i of invoices) store.invoices.set(i.id, i);
  for (const it of items) store.invoiceItems.set(it.id, it);
  for (const p of payments) store.payments.set(p.id, p);
});

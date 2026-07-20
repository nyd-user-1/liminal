import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";

// Stripe Connect repo — the local mirror of marketplace state (sql/061).
//
// Stripe is the source of truth for what an account may DO; these rows are a
// cache so a page render doesn't have to call Stripe, plus the two ledgers that
// make the webhook safe: stripe_events (idempotency) and stripe_payment_splits
// (what actually got paid to whom, and what we kept).
//
// Dual-mode per the repo convention. The mock side is a module-local store
// rather than an entry in lib/mock/index.ts on purpose: that file is shared
// across concurrent sessions and Connect is a self-contained surface — nothing
// else in the mock graph references these rows.
//
// NO PHI in any field here or in anything derived from it.

export interface ConnectAccount {
  id: string;
  userId: string | null;
  orgTin: string | null;
  stripeAccountId: string;
  businessType: "individual" | "company" | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  /** Stripe's requirements object, verbatim (currently_due, past_due, disabled_reason…). */
  requirementsDue: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSplit {
  id: string;
  invoiceId: string | null;
  paymentIntentId: string;
  checkoutSessionId: string | null;
  destinationAccountId: string;
  amountCents: number;
  applicationFeeCents: number;
  currency: string;
  transferId: string | null;
  createdAt: string;
}

/** Owner of a connected account — a practitioner today, a billing TIN later. */
export type AccountOwner = { userId: string; orgTin?: null } | { orgTin: string; userId?: null };

type AccountRow = {
  id: string;
  user_id: string | null;
  org_tin: string | null;
  stripe_account_id: string;
  business_type: "individual" | "company" | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_due: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toAccount(r: AccountRow): ConnectAccount {
  return {
    id: r.id,
    userId: r.user_id,
    orgTin: r.org_tin,
    stripeAccountId: r.stripe_account_id,
    businessType: r.business_type,
    chargesEnabled: r.charges_enabled,
    payoutsEnabled: r.payouts_enabled,
    detailsSubmitted: r.details_submitted,
    requirementsDue: r.requirements_due,
    createdAt: isoDateTime(r.created_at)!,
    updatedAt: isoDateTime(r.updated_at)!,
  };
}

// ── mock store (no DB) ───────────────────────────────────────────────────────

interface MockConnectStore {
  accounts: Map<string, ConnectAccount>; // keyed by stripeAccountId
  events: Map<string, { id: string; type: string; processedAt: string | null; error: string | null }>;
  splits: Map<string, PaymentSplit>; // keyed by paymentIntentId
}
let _mock: MockConnectStore | null = null;
function mock(): MockConnectStore {
  if (!_mock) _mock = { accounts: new Map(), events: new Map(), splits: new Map() };
  return _mock;
}
let _mockSeq = 0;
const mockId = () => `mock_${++_mockSeq}`;

// ── accounts ─────────────────────────────────────────────────────────────────

/** The connected account for an owner, or null if they've never created one. */
export async function getConnectAccount(owner: AccountOwner): Promise<ConnectAccount | null> {
  const userId = owner.userId ?? null;
  const orgTin = owner.orgTin ?? null;
  if (hasDb) {
    const rows = (await sql`
      SELECT * FROM stripe_connect_accounts
      WHERE (${userId}::uuid IS NOT NULL AND user_id = ${userId}::uuid)
         OR (${orgTin}::text IS NOT NULL AND org_tin = ${orgTin}::text)
      LIMIT 1
    `) as AccountRow[];
    return rows[0] ? toAccount(rows[0]) : null;
  }
  const found = [...mock().accounts.values()].find((a) =>
    userId ? a.userId === userId : a.orgTin === orgTin,
  );
  return found ?? null;
}

/** Look an account up by its Stripe id — the webhook's entry point. */
export async function getConnectAccountByStripeId(stripeAccountId: string): Promise<ConnectAccount | null> {
  if (hasDb) {
    const rows = (await sql`
      SELECT * FROM stripe_connect_accounts WHERE stripe_account_id = ${stripeAccountId} LIMIT 1
    `) as AccountRow[];
    return rows[0] ? toAccount(rows[0]) : null;
  }
  return mock().accounts.get(stripeAccountId) ?? null;
}

/**
 * Record a freshly created Stripe account. ON CONFLICT on the stripe id makes a
 * double-submit harmless; the partial unique on the owner is what stops a second
 * account being created for the same therapist (the route checks first, this is
 * the backstop).
 */
export async function insertConnectAccount(input: {
  owner: AccountOwner;
  stripeAccountId: string;
  businessType?: "individual" | "company" | null;
}): Promise<ConnectAccount> {
  const userId = input.owner.userId ?? null;
  const orgTin = input.owner.orgTin ?? null;
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO stripe_connect_accounts (user_id, org_tin, stripe_account_id, business_type)
      VALUES (${userId}::uuid, ${orgTin}, ${input.stripeAccountId}, ${input.businessType ?? null})
      ON CONFLICT (stripe_account_id) DO UPDATE SET updated_at = now()
      RETURNING *
    `) as AccountRow[];
    return toAccount(rows[0]);
  }
  const now = new Date().toISOString();
  const acct: ConnectAccount = {
    id: mockId(),
    userId,
    orgTin,
    stripeAccountId: input.stripeAccountId,
    businessType: input.businessType ?? null,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    requirementsDue: null,
    createdAt: now,
    updatedAt: now,
  };
  mock().accounts.set(acct.stripeAccountId, acct);
  return acct;
}

/**
 * Sync the capability mirror from a retrieved/updated Stripe account. Called
 * from both GET /api/connect/status and the account.updated webhook — they must
 * write the same columns the same way, so they share this one function.
 */
export async function syncConnectAccount(
  stripeAccountId: string,
  status: {
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    requirementsDue: Record<string, unknown> | null;
    businessType?: "individual" | "company" | null;
  },
): Promise<ConnectAccount | null> {
  if (hasDb) {
    const rows = (await sql`
      UPDATE stripe_connect_accounts SET
        charges_enabled   = ${status.chargesEnabled},
        payouts_enabled   = ${status.payoutsEnabled},
        details_submitted = ${status.detailsSubmitted},
        requirements_due  = ${JSON.stringify(status.requirementsDue ?? null)}::jsonb,
        business_type     = COALESCE(${status.businessType ?? null}, business_type),
        updated_at        = now()
      WHERE stripe_account_id = ${stripeAccountId}
      RETURNING *
    `) as AccountRow[];
    return rows[0] ? toAccount(rows[0]) : null;
  }
  const acct = mock().accounts.get(stripeAccountId);
  if (!acct) return null;
  Object.assign(acct, {
    chargesEnabled: status.chargesEnabled,
    payoutsEnabled: status.payoutsEnabled,
    detailsSubmitted: status.detailsSubmitted,
    requirementsDue: status.requirementsDue,
    businessType: status.businessType ?? acct.businessType,
    updatedAt: new Date().toISOString(),
  });
  return acct;
}

/**
 * Who to notify about a connected account. The webhook knows only acct_…, and
 * "you've been paid" / "a dispute was opened" have to reach a person. Name and
 * email only — never widen this into a general user read.
 */
export async function connectAccountContact(
  stripeAccountId: string,
): Promise<{ userId: string; name: string; email: string } | null> {
  if (hasDb) {
    const rows = (await sql`
      SELECT u.id, u.name, u.email
      FROM stripe_connect_accounts a
      JOIN users u ON u.id = a.user_id
      WHERE a.stripe_account_id = ${stripeAccountId} AND u.deleted_at IS NULL
      LIMIT 1
    `) as Array<{ id: string; name: string; email: string }>;
    return rows[0] ? { userId: rows[0].id, name: rows[0].name, email: rows[0].email } : null;
  }
  return null; // mock mode has no user graph wired to Connect
}

// ── events (idempotency ledger) ──────────────────────────────────────────────

/**
 * Claim a webhook event. Returns true if THIS call won the insert and should do
 * the work; false if the event was already recorded (Stripe redelivery, or two
 * concurrent deliveries racing). The row is written before any side effect, so a
 * crash mid-handler leaves processed_at NULL — visible as unfinished, not lost.
 */
export async function claimStripeEvent(evt: {
  id: string;
  type: string;
  stripeAccountId?: string | null;
  payload: unknown;
}): Promise<boolean> {
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO stripe_events (id, type, stripe_account_id, payload)
      VALUES (${evt.id}, ${evt.type}, ${evt.stripeAccountId ?? null}, ${JSON.stringify(evt.payload)}::jsonb)
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `) as Array<{ id: string }>;
    return rows.length > 0;
  }
  if (mock().events.has(evt.id)) return false;
  mock().events.set(evt.id, { id: evt.id, type: evt.type, processedAt: null, error: null });
  return true;
}

/** Mark a claimed event finished (or record why it failed). */
export async function completeStripeEvent(id: string, error?: string): Promise<void> {
  if (hasDb) {
    // On failure, processed_at STAYS NULL — that is the worklist contract
    // (sql/061: `WHERE processed_at IS NULL` finds every unfinished event,
    // whether the handler threw or the process died). error says why.
    if (error) {
      await sql`UPDATE stripe_events SET error = ${error} WHERE id = ${id}`;
    } else {
      await sql`UPDATE stripe_events SET processed_at = now(), error = NULL WHERE id = ${id}`;
    }
    return;
  }
  const e = mock().events.get(id);
  if (!e) return;
  if (error) e.error = error;
  else e.processedAt = new Date().toISOString();
}

// ── payment splits ───────────────────────────────────────────────────────────

/**
 * Record what a marketplace payment actually did: gross, our fee, destination.
 * Keyed on the PaymentIntent so a redelivered settlement is a no-op. Written
 * only from the webhook — the success redirect is a UX convenience, not proof.
 */
export async function recordPaymentSplit(input: {
  invoiceId?: string | null;
  paymentIntentId: string;
  checkoutSessionId?: string | null;
  destinationAccountId: string;
  amountCents: number;
  applicationFeeCents: number;
  currency?: string;
  transferId?: string | null;
}): Promise<void> {
  if (hasDb) {
    await sql`
      INSERT INTO stripe_payment_splits (
        invoice_id, payment_intent_id, checkout_session_id, destination_account_id,
        amount_cents, application_fee_cents, currency, transfer_id
      ) VALUES (
        ${input.invoiceId ?? null}::uuid, ${input.paymentIntentId}, ${input.checkoutSessionId ?? null},
        ${input.destinationAccountId}, ${input.amountCents}, ${input.applicationFeeCents},
        ${input.currency ?? "usd"}, ${input.transferId ?? null}
      )
      ON CONFLICT (payment_intent_id) DO UPDATE SET
        transfer_id = COALESCE(EXCLUDED.transfer_id, stripe_payment_splits.transfer_id)
    `;
    return;
  }
  mock().splits.set(input.paymentIntentId, {
    id: mockId(),
    invoiceId: input.invoiceId ?? null,
    paymentIntentId: input.paymentIntentId,
    checkoutSessionId: input.checkoutSessionId ?? null,
    destinationAccountId: input.destinationAccountId,
    amountCents: input.amountCents,
    applicationFeeCents: input.applicationFeeCents,
    currency: input.currency ?? "usd",
    transferId: input.transferId ?? null,
    createdAt: new Date().toISOString(),
  });
}

/** Splits for one connected account, newest first — the "you've been paid" feed. */
export async function listPaymentSplits(
  destinationAccountId: string,
  limit = 50,
): Promise<PaymentSplit[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT * FROM stripe_payment_splits
      WHERE destination_account_id = ${destinationAccountId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      invoiceId: (r.invoice_id as string) ?? null,
      paymentIntentId: r.payment_intent_id as string,
      checkoutSessionId: (r.checkout_session_id as string) ?? null,
      destinationAccountId: r.destination_account_id as string,
      amountCents: r.amount_cents as number,
      applicationFeeCents: r.application_fee_cents as number,
      currency: r.currency as string,
      transferId: (r.transfer_id as string) ?? null,
      createdAt: isoDateTime(r.created_at as Date | string)!,
    }));
  }
  return [...mock().splits.values()]
    .filter((s) => s.destinationAccountId === destinationAccountId)
    .slice(0, limit);
}

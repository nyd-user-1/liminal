// Stripe Connect marketplace notifications (TASK-STRIPE-MARKETPLACE T5).
//
// STUB COMMIT — signatures are FINAL and safe to import/call today; bodies land
// in the next commit on this file. Every function returns Promise<boolean> and
// never throws, matching lib/email.ts: notification is best-effort and must not
// break the webhook that calls it.
//
// These are webhook-driven (checkout.session.completed, charge.dispute.created,
// account.updated) plus one manual nudge. Callers should NOT await-and-branch on
// the result beyond logging — a false means "email not configured", not "the
// payment failed".
//
// PHI RULE (brief §Hard guardrails): names and amounts only. No service names,
// no diagnoses, no appointment detail, no clinical context — a payment receipt
// is not a place to leak that someone is in therapy for a particular reason.

export type MoneySplit = {
  /** What the client was charged, in cents. */
  grossCents: number;
  /** Liminal's application fee, in cents. */
  feeCents: number;
  /** What lands in the therapist's connected account, in cents. */
  netCents: number;
};

/** Client-facing receipt after a successful Connect checkout. */
export async function sendPaymentReceipt(opts: {
  to: string;
  firstName: string;
  amountCents: number;
  invoiceNumber: string;
  invoiceId: string;
  practitionerName: string;
}): Promise<boolean> {
  void opts;
  return false; // TODO(T5): implement
}

/** Therapist-facing payout note — gross, fee withheld, net. */
export async function sendTherapistPaid(opts: {
  to: string;
  practitionerName: string;
  split: MoneySplit;
  invoiceNumber: string;
  /** Optional — the therapist's own client; omit rather than guess. */
  clientName?: string | null;
}): Promise<boolean> {
  void opts;
  return false; // TODO(T5): implement
}

/** Practice-facing alert when Stripe opens a dispute. */
export async function sendDisputeAlert(opts: {
  /** Defaults to LIMINAL_OPS_EMAIL when omitted. */
  to?: string | null;
  amountCents: number;
  reason: string;
  disputeId: string;
  /** Stripe's respond-by deadline, ISO string, when present on the event. */
  dueBy?: string | null;
  invoiceNumber?: string | null;
}): Promise<boolean> {
  void opts;
  return false; // TODO(T5): implement
}

/** Nudge a therapist whose Connect onboarding is started but not finished. */
export async function sendOnboardingNudge(opts: {
  to: string;
  practitionerName: string;
  /** Stripe `requirements.currently_due` entries, already human-readable. */
  outstanding: string[];
}): Promise<boolean> {
  void opts;
  return false; // TODO(T5): implement
}

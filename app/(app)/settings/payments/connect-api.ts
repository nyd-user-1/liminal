// Client-side contract with the Connect API routes (`app/api/connect/**`, owned
// by the API seam; see docs/TASK-STRIPE-MARKETPLACE.md T2). The UI never reads
// `lib/repos/stripe-connect.ts` directly — every state transition on the "Get
// paid" surface goes through these five calls, so the two seams only have to
// agree on JSON.

/** Connected-account state as the UI needs it. Mirrors the T1 columns. */
export interface ConnectAccountStatus {
  stripeAccountId: string;
  businessType: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  /** `requirements.currently_due` — raw Stripe requirement keys. */
  requirementsDue: string[];
}

/**
 * Repos hand back camelCase (house convention) but a route that passes a Stripe
 * account object straight through would be snake_case, and Stripe's own field
 * names are what a hurried implementation reaches for. Accept both rather than
 * silently rendering "not set up yet" over a live account.
 */
function normalizeStatus(raw: Record<string, unknown>): ConnectAccountStatus | null {
  const id = (raw.stripeAccountId ?? raw.stripe_account_id ?? raw.id) as string | undefined;
  if (!id) return null;
  const due = (raw.requirementsDue ?? raw.requirements_due ?? []) as unknown;
  return {
    stripeAccountId: id,
    businessType: ((raw.businessType ?? raw.business_type) as string | null) ?? null,
    chargesEnabled: Boolean(raw.chargesEnabled ?? raw.charges_enabled),
    payoutsEnabled: Boolean(raw.payoutsEnabled ?? raw.payouts_enabled),
    detailsSubmitted: Boolean(raw.detailsSubmitted ?? raw.details_submitted),
    requirementsDue: Array.isArray(due) ? due.filter((d): d is string => typeof d === "string") : [],
  };
}

/** Surface phase — what the practitioner is actually looking at. */
export type ConnectStage = "none" | "onboarding" | "pending" | "active";

/**
 * `charges_enabled` is the only gate that matters for taking money;
 * `details_submitted` just means the form was finished, which is why "pending"
 * exists as its own state (Stripe is still verifying, or something bounced).
 */
export function connectStage(account: ConnectAccountStatus | null): ConnectStage {
  if (!account) return "none";
  if (account.chargesEnabled) return "active";
  if (account.detailsSubmitted) return "pending";
  return "onboarding";
}

async function call(path: string, method: "GET" | "POST"): Promise<Record<string, unknown>> {
  const res = await fetch(path, method === "POST" ? { method: "POST" } : undefined);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `${path} failed (${res.status}).`,
    );
  }
  return data;
}

/** GET /api/connect/status → `{ account: {...} | null }`. */
export async function fetchConnectStatus(): Promise<ConnectAccountStatus | null> {
  const data = await call("/api/connect/status", "GET");
  const account = (data.account ?? data) as Record<string, unknown> | null;
  return account ? normalizeStatus(account) : null;
}

/** POST /api/connect/account → creates the v1 account, returns the fresh status. */
export async function createConnectAccount(): Promise<ConnectAccountStatus | null> {
  const data = await call("/api/connect/account", "POST");
  const account = (data.account ?? data) as Record<string, unknown> | null;
  return account ? normalizeStatus(account) : null;
}

/** POST /api/connect/account-session → `{ clientSecret }` for the embedded components. */
export async function fetchAccountSessionSecret(): Promise<string> {
  const data = await call("/api/connect/account-session", "POST");
  const secret = (data.clientSecret ?? data.client_secret) as string | undefined;
  if (!secret) throw new Error("The account session came back without a client secret.");
  return secret;
}

/** POST /api/connect/account-link → `{ url }`. Hosted-onboarding fallback. */
export async function fetchAccountLinkUrl(): Promise<string> {
  const data = await call("/api/connect/account-link", "POST");
  const url = data.url as string | undefined;
  if (!url) throw new Error("The onboarding link came back empty.");
  return url;
}

/**
 * POST /api/connect/login-link → `{ url }` for the Express Dashboard. NOT in the
 * T2 route list — the UI asks for it and degrades to an inline message if the
 * route isn't there, since the embedded account-management component already
 * covers everything the dashboard does.
 */
export async function fetchLoginLinkUrl(): Promise<string> {
  const data = await call("/api/connect/login-link", "POST");
  const url = data.url as string | undefined;
  if (!url) throw new Error("The dashboard link came back empty.");
  return url;
}

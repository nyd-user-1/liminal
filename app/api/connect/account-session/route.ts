import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { getConnectAccount } from "@/lib/repos/stripe-connect";
import { getStripe } from "@/lib/stripe";

/**
 * Mint an AccountSession client secret for the embedded Connect components.
 *
 * The secret is short-lived and scoped to ONE connected account, which is why
 * this route derives the account from the session user and never accepts an
 * account id from the request body — taking acct_… from the client would let
 * any signed-in practitioner mint a session for someone else's account and read
 * their balances and payouts.
 *
 * Component set matches the "Get paid" surface (T3): onboarding, the
 * notification banner (Stripe's own "you need to do X" strip), account
 * management, and the money views.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  void req;
  try {
    const user = await requireRole("practitioner");

    const row = await getConnectAccount({ userId: user.id });
    if (!row) {
      return NextResponse.json({ error: "No payout account yet. Create one first." }, { status: 404 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Payments are not configured on this environment." }, { status: 503 });
    }

    const session = await stripe.accountSessions.create({
      account: row.stripeAccountId,
      components: {
        account_onboarding: { enabled: true },
        notification_banner: { enabled: true },
        account_management: { enabled: true },
        balances: { enabled: true },
        payouts: { enabled: true },
      },
    });

    await logEvent({
      actorId: user.id,
      action: "connect.account_session",
      entity: "stripe_connect_account",
      entityId: row.id,
      meta: { stripeAccount: row.stripeAccountId },
    });

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[connect] account-session error:", err);
    return NextResponse.json({ error: "Could not start the payout session." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { getConnectAccount } from "@/lib/repos/stripe-connect";
import { getStripe } from "@/lib/stripe";

/**
 * One-time Express Dashboard link for the caller's own connected account.
 * Omitted from the original T2 route list; the Settings surface asks for it
 * (fetchLoginLinkUrl → { url }) — added by founder ruling 2026-07-20.
 *
 * Same hygiene as account-link: the URL is single-use and short-lived, so it
 * is returned to the caller for an immediate redirect and never logged or
 * emailed. Stripe rejects the call for accounts that aren't Express-dashboard
 * or haven't finished onboarding — that surfaces as the generic 500; the UI
 * only shows the button in the active state.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireRole("practitioner");

    const account = await getConnectAccount({ userId: user.id });
    if (!account) {
      return NextResponse.json({ error: "No payout account yet." }, { status: 404 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Payments are not configured on this environment (STRIPE_SECRET_KEY missing)." },
        { status: 503 },
      );
    }

    const link = await stripe.accounts.createLoginLink(account.stripeAccountId);
    await logEvent({
      actorId: user.id,
      action: "connect.login_link_created",
      entity: "stripe_connect_account",
      entityId: account.id,
      meta: { stripeAccount: account.stripeAccountId },
    });
    return NextResponse.json({ url: link.url });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[connect] login-link error:", err);
    return NextResponse.json({ error: "Could not create a dashboard link." }, { status: 500 });
  }
}

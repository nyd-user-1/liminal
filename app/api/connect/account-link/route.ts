import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { getConnectAccount } from "@/lib/repos/stripe-connect";
import { getStripe } from "@/lib/stripe";

/**
 * Hosted-onboarding fallback for when the embedded component can't be used.
 *
 * Account Link URLs are SINGLE-USE, short-lived, and grant access to the
 * onboarding flow for one account — so this route returns the URL to the
 * signed-in owner for an immediate in-app redirect and nothing else. Never
 * email one, never log the full URL, never persist it.
 *
 * Stripe requires HTTPS return/refresh targets even in development. We take the
 * base from CONNECT_RETURN_BASE_URL (set it to a tunnel or the deployed domain)
 * and refuse to build a link from a plain-http origin rather than silently
 * handing Stripe a URL it will reject.
 */
export const dynamic = "force-dynamic";

function returnBase(req: NextRequest): string | null {
  const configured = process.env.CONNECT_RETURN_BASE_URL?.replace(/\/$/, "");
  if (configured?.startsWith("https://")) return configured;
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  return origin.startsWith("https://") ? origin.replace(/\/$/, "") : null;
}

export async function POST(req: NextRequest) {
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

    const base = returnBase(req);
    if (!base) {
      return NextResponse.json(
        {
          error:
            "Hosted onboarding needs an HTTPS return URL. Set CONNECT_RETURN_BASE_URL to a tunnel or the deployed domain.",
        },
        { status: 503 },
      );
    }

    const link = await stripe.accountLinks.create({
      account: row.stripeAccountId,
      type: "account_onboarding",
      return_url: `${base}/settings/payments?connect=return`,
      refresh_url: `${base}/settings/payments?connect=refresh`,
    });

    await logEvent({
      actorId: user.id,
      action: "connect.account_link",
      entity: "stripe_connect_account",
      entityId: row.id,
      meta: { stripeAccount: row.stripeAccountId }, // never the URL itself
    });

    return NextResponse.json({ url: link.url, expiresAt: link.expires_at });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[connect] account-link error:", err);
    return NextResponse.json({ error: "Could not start hosted onboarding." }, { status: 500 });
  }
}

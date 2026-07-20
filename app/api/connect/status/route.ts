import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole } from "@/lib/auth";
import { getConnectAccount, syncConnectAccount } from "@/lib/repos/stripe-connect";
import { getStripe } from "@/lib/stripe";

/**
 * The practitioner's payout-account status, refreshed from Stripe on read.
 *
 * We re-retrieve rather than trusting our mirror because the mirror is only as
 * current as the last account.updated we received, and the whole point of this
 * endpoint is the UI asking "can this person take money yet?". If Stripe is
 * unreachable we return the cached row and say so (`stale: true`) instead of
 * failing the page — but a stale row is never allowed to CLAIM charges are
 * enabled that Stripe hasn't confirmed, because the cached value is whatever
 * Stripe last told us, not an optimistic default.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  void req;
  try {
    const user = await requireRole("practitioner");

    const row = await getConnectAccount({ userId: user.id });
    if (!row) return NextResponse.json({ account: null });

    const stripe = getStripe();
    if (!stripe) return NextResponse.json({ account: row, stale: true });

    try {
      const acct = await stripe.accounts.retrieve(row.stripeAccountId);
      const synced = await syncConnectAccount(row.stripeAccountId, {
        chargesEnabled: acct.charges_enabled ?? false,
        payoutsEnabled: acct.payouts_enabled ?? false,
        detailsSubmitted: acct.details_submitted ?? false,
        requirementsDue: (acct.requirements as Record<string, unknown> | undefined) ?? null,
        businessType: (acct.business_type as "individual" | "company" | null) ?? null,
      });
      await logEvent({
        actorId: user.id,
        action: "connect.status_read",
        entity: "stripe_connect_account",
        entityId: row.id,
        meta: { stripeAccount: row.stripeAccountId, chargesEnabled: synced?.chargesEnabled ?? false },
      });
      return NextResponse.json({ account: synced ?? row });
    } catch (err) {
      console.error("[connect] status retrieve failed, serving cached row:", err);
      return NextResponse.json({ account: row, stale: true });
    }
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[connect] status error:", err);
    return NextResponse.json({ error: "Could not load payout status." }, { status: 500 });
  }
}

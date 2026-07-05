import Stripe from "stripe";

/**
 * Lazy Stripe client (same guarded pattern as lib/db.ts; adapted from
 * tariffs/src/lib/stripe.ts). Reads STRIPE_SECRET_KEY; returns null when it's
 * absent so callers DEGRADE GRACEFULLY to the mock checkout path instead of
 * throwing. The whole invoice-collection flow is demoable with zero env vars —
 * when a real key lands, the same code does a real Stripe Checkout redirect.
 *
 *   const stripe = getStripe();
 *   if (!stripe) { ...mock checkout... } else { ...real Checkout session... }
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

/** True when a live Stripe key is configured. */
export function hasStripe(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

import { GetPaidSettings } from "./get-paid-client";

// Settings › Get paid — Stripe Connect payouts for the practitioner. Auth is
// already handled by app/(app)/layout.tsx (no session → /sign-in, clients →
// /portal). Account state is fetched client-side from /api/connect/status so
// this seam depends on the route contract only, never on the repo module.

export default function GetPaidSettingsPage() {
  return <GetPaidSettings publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""} />;
}

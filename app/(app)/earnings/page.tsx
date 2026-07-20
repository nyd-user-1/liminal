import { Suspense } from "react";
import { EarningsClient } from "./earnings-client";

// Earnings — Stripe Connect money view for the practitioner (balance,
// transactions with the per-charge application-fee split, payouts). Auth is
// handled by app/(app)/layout.tsx (no session → /sign-in, clients → /portal),
// so this route is practitioner-only by construction. Account state is fetched
// client-side from /api/connect/status; this seam depends on the route contract
// only, never on the repo module. Suspense wraps the client because it reads
// search params (?view=, ?payment=) for deep-linking.

export default function EarningsPage() {
  return (
    <Suspense>
      <EarningsClient publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""} />
    </Suspense>
  );
}

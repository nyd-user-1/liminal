import { RatesShell } from "@/components/rates/rates-shell";
import { getUser } from "@/lib/auth";

// "Know your rates" — provider-side rate intelligence over payer-published
// negotiated rates (provider_rate_signals via lib/repos/rate-signals.ts only).
// The (app) layout already gates practitioners; the H1 lives in the TopBar
// (ROUTE_TITLES) per the canonical layout rule. Data loads client-side through
// /api/rates/* so lookups and entered figures stay interactive.

export default async function RatesPage() {
  const user = await getUser();
  return <RatesShell userEmail={user?.email} />;
}

// The /billing route's content (Overview/Clients/Payers tabs) now renders
// entirely inside BillingShell (billing/layout.tsx), which already has
// `invoices` from the layout — no separate fetch needed here. This file only
// exists so the segment resolves as a route; BillingShell doesn't render
// `children` except on /billing/[id] (the invoice detail).

export const dynamic = "force-dynamic";

export default function BillingPage() {
  return null;
}

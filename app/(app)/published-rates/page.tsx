import { PublishedRatesClient } from "./published-rates-client";
import { getRateTable } from "@/lib/repos/rate-table";

// /published-rates — every insurer's published-rate corpus for New York: one row
// per (billing TIN, insurer), five codes. Not a lookup tool: there's no "enter
// your TIN" gate, the whole table renders by default and the controls only
// narrow it. The reader recognizes their own row as true, and that recognition
// is what makes every other row credible.
//
// The H1 lives in the TopBar (ROUTE_TITLES in components/shell/topbar.tsx) —
// nothing here renders a page-level H1. No logEvent: this reads zero PHI.
//
// One read: insurer / entity type / credential are all client-side filters
// over the loaded set. The 1h cache lives in the repo, not unstable_cache —
// the corpus is ~12MB and Next's data cache rejects >2MB. searchParams only
// SEED the client filters (deep links from the /orgs Map tab: ?payer=…&q=…);
// they never change what is fetched.

export default async function PublishedRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ payer?: string; q?: string }>;
}) {
  const { payer, q } = await searchParams;
  const data = await getRateTable();
  return <PublishedRatesClient data={data} initialPayer={payer} initialQ={q} />;
}

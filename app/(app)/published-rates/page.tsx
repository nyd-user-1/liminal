import { PublishedRatesClient } from "./published-rates-client";
import { resolveRatePayer } from "@/lib/rate-table";
import { getRateTable } from "@/lib/repos/rate-table";

// /published-rates — the full published-rate corpus for one insurer, every
// billing entity in New York, five codes. Not a lookup tool: there's no "enter
// your TIN" gate, the whole table renders by default and search/filters only
// narrow it. The reader recognizes their own row as true, and that recognition
// is what makes every other row credible.
//
// The H1 lives in the TopBar (ROUTE_TITLES in components/shell/topbar.tsx) —
// nothing here renders a page-level H1. No logEvent: this reads zero PHI.
//
// The 1h per-payer cache lives in the repo, not unstable_cache here: the corpus
// is ~4MB and Next's data cache hard-rejects entries over 2MB. See the comment
// on getRateTable.

export default async function PublishedRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ payer?: string }>;
}) {
  const { payer } = await searchParams;
  const data = await getRateTable(resolveRatePayer(payer));
  return <PublishedRatesClient data={data} />;
}

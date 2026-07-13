import { requireRole } from "@/lib/auth";
import { listRatedProviders } from "@/lib/repos/rate-directory";
import { RateDirectory } from "@/components/rate-directory/rate-directory";

// Recruiting — a ranked, searchable directory of every provider we hold rates
// for: payer breadth + best per-session rate per code. Click a row to drill
// into their profile / book of business. Reads provider_rate_summary (sql/021,
// pre-aggregated) so it's instant. Public-record data, not PHI. H1 in TopBar.
export const dynamic = "force-dynamic";

export default async function RecruitingPage() {
  await requireRole("practitioner");
  const providers = await listRatedProviders();
  return <RateDirectory providers={providers} />;
}

import { requireRole } from "@/lib/auth";
import { listEmployers } from "@/lib/repos/plans";
import { PlansIndex } from "./plans-index";

// Plans catalog — self-funded employer plan sponsors → networks → rates.
// Public-record data (payer TiC filings), not PHI: no logEvent (mirrors the
// /api/rates public-read convention).
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  await requireRole("practitioner");
  const employers = await listEmployers();
  return <PlansIndex employers={employers} />;
}

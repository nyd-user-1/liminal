import { RecruitingShell } from "@/components/rates/recruiting-shell";

// Recruiting — a practice owner checks a candidate NPI's credentialing
// footprint (lib/repos/rate-signals.ts via /api/rates/footprint only). The
// (app) layout gates practitioners; the H1 lives in the TopBar (ROUTE_TITLES)
// per the canonical layout rule.

export default function RecruitingPage() {
  return <RecruitingShell />;
}

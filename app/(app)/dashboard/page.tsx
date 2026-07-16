import { redirect } from "next/navigation";

// /dashboard → /insights (renamed 2026-07-16). Old links and muscle memory
// land here; the page lives at app/(app)/insights.
export default function DashboardRedirect() {
  redirect("/insights");
}

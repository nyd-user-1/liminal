import { redirect } from "next/navigation";

// /insights moved to /workspace (2026-07-18). Old links live in sent ops
// emails and notification rows — keep them landing somewhere real.
export default function InsightsRedirect() {
  redirect("/workspace");
}

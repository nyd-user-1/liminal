import { redirect } from "next/navigation";

// /settings has no page of its own — it opens on the first tab, matching how the
// tabbed section behaves. The tab bar lives in settings/layout.tsx.
export default function SettingsPage() {
  redirect("/settings/services");
}

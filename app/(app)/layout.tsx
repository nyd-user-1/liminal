import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getUser } from "@/lib/auth";

// Workspace shell (practitioner/admin). Clients are bounced to their portal.

// Match the iPhone status-bar band to the white TopBar.
export const viewport: Viewport = { themeColor: "#ffffff" };

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  if (user.role === "client") redirect("/portal");
  return (
    <AppShell variant="workspace" user={user}>
      {children}
    </AppShell>
  );
}

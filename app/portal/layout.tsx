import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getUser } from "@/lib/auth";

// Client portal shell.

// Match the iPhone status-bar band to the warm-paper shell ground.
export const viewport: Viewport = { themeColor: "#F7F3E8" };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return (
    <AppShell variant="portal" user={user}>
      {children}
    </AppShell>
  );
}

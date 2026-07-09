import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getUser } from "@/lib/auth";

// Client portal shell.

// Match the iPhone status-bar band to the white TopBar (bottom overscroll
// already matches: body + main are canvas).
export const viewport: Viewport = { themeColor: "#ffffff" };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return (
    <AppShell variant="portal" user={user}>
      {children}
    </AppShell>
  );
}

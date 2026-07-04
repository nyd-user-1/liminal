import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getUser } from "@/lib/auth";

// Client portal shell.

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return (
    <AppShell variant="portal" user={user}>
      {children}
    </AppShell>
  );
}

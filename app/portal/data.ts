import { redirect } from "next/navigation";
import { getUser, type SessionUser } from "@/lib/auth";
import { clientForUser } from "@/lib/repos/threads";
import type { Client } from "@/lib/types";

// Shared portal-page guard: signed-in client role + their client record
// (clients.user_id mapping — e.g. casey@liminal.demo → Casey Morgan).
// Practitioners/admins are bounced to their workspace by the root redirect.

export async function requirePortalClient(): Promise<{ user: SessionUser; client: Client | null }> {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "client") redirect("/");
  const client = await clientForUser(user.id);
  return { user, client };
}

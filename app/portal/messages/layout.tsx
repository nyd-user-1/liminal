import { InboxShell } from "@/components/messaging/inbox-shell";
import { listThreads } from "@/lib/repos/threads";
import { requirePortalClient } from "../data";

// Portal Messages segment layout — owns the thread-list pane so /portal/messages
// and /portal/messages/[id] share one split view; the page renders into the
// right pane. Reuses the practitioner InboxShell in its "client" variant.

export const dynamic = "force-dynamic";

export default async function PortalMessagesLayout({ children }: { children: React.ReactNode }) {
  const { client } = await requirePortalClient();
  const threads = client ? await listThreads({ clientId: client.id }) : [];
  return (
    <InboxShell variant="client" basePath="/portal/messages" threads={threads}>
      {children}
    </InboxShell>
  );
}

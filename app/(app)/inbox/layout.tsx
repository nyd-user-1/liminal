import { InboxShell } from "@/components/messaging/inbox-shell";
import { listThreads, threadClients } from "@/lib/repos/threads";

// Inbox segment layout — owns the thread-list pane so /inbox and
// /inbox/[id] share one split view; the page renders into the right pane.

export const dynamic = "force-dynamic";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const [threads, clients] = await Promise.all([listThreads(), threadClients()]);
  return (
    <InboxShell threads={threads} clients={clients}>
      {children}
    </InboxShell>
  );
}

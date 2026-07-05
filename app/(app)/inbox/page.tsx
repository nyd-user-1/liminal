import { InboxList } from "@/components/messaging/inbox-list";
import { listThreads, threadClients } from "@/lib/repos/threads";

// Practitioner Inbox — secure-messaging thread index (Portal/Inbox, task 10).
// The (app) layout guarantees a practitioner/admin session.

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [threads, clients] = await Promise.all([listThreads(), threadClients()]);
  return <InboxList threads={threads} clients={clients} />;
}

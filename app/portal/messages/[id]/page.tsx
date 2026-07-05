import { notFound } from "next/navigation";
import { ThreadView } from "@/components/messaging/thread-view";
import { TextLink } from "@/components/ui/text-link";
import { logEvent } from "@/lib/audit";
import { getThread, markRead } from "@/lib/repos/threads";
import { requirePortalClient } from "../../data";

// Portal thread view — same bubbles as the practitioner inbox, no
// Close/Reopen. Scoped to the signed-in client's own threads.

export const dynamic = "force-dynamic";

export default async function PortalThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, client } = await requirePortalClient();
  const { id } = await params;
  const detail = await getThread(id);
  if (!detail || !client || detail.thread.clientId !== client.id) notFound();

  await markRead(id, user.id);
  await logEvent({ actorId: user.id, action: "thread.view", entity: "thread", entityId: id });

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <TextLink href="/portal/messages" icon="arrow-left" className="mb-4">
        Back to messages
      </TextLink>
      <div className="min-h-0 flex-1">
        <ThreadView thread={detail.thread} messages={detail.messages} senders={detail.senders} meId={user.id} />
      </div>
    </div>
  );
}

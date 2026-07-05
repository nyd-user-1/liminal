import { notFound, redirect } from "next/navigation";
import { ThreadView } from "@/components/messaging/thread-view";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { logEvent } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { getThread, markRead } from "@/lib/repos/threads";

// Practitioner thread view — bubbles + composer + Close/Reopen.

export const dynamic = "force-dynamic";

export default async function InboxThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const { id } = await params;
  const detail = await getThread(id);
  if (!detail) notFound();

  await markRead(id, user.id);
  await logEvent({ actorId: user.id, action: "thread.view", entity: "thread", entityId: id });

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <Breadcrumb items={[{ label: "Inbox", href: "/inbox" }, { label: detail.thread.subject }]} className="mb-4" />
      <div className="min-h-0 flex-1">
        <ThreadView
          thread={detail.thread}
          messages={detail.messages}
          senders={detail.senders}
          meId={user.id}
          canManage
        />
      </div>
    </div>
  );
}

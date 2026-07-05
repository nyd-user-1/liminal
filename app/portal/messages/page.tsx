import { EmptyState } from "@/components/ui/empty-state";
import { listThreads } from "@/lib/repos/threads";
import { requirePortalClient } from "../data";
import { MessagesList } from "./messages-list";

// Portal Messages — the client's secure-message threads.

export const dynamic = "force-dynamic";

export default async function PortalMessagesPage() {
  const { client } = await requirePortalClient();
  if (!client) {
    return (
      <>
        <EmptyState icon="message" title="No client record is linked to this login" />
      </>
    );
  }

  const threads = await listThreads({ clientId: client.id });
  return <MessagesList threads={threads} />;
}

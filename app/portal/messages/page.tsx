import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
        <PageHeader icon="message" title="Messages" className="mb-6" />
        <EmptyState icon="message" title="No client record is linked to this login" />
      </>
    );
  }

  const threads = await listThreads({ clientId: client.id });
  return <MessagesList threads={threads} />;
}

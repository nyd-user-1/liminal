import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

// Placeholder — replaced by the Portal/Inbox agent (task 10).
export default function InboxPage() {
  return (
    <>
      <PageHeader icon="inbox" title="Inbox" className="mb-6" />
      <EmptyState icon="inbox" title="No conversations yet" subtext="Client messages will appear here." />
    </>
  );
}

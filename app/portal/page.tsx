import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

// Placeholder — replaced by the Portal/Inbox agent (task 10).
export default function PortalHomePage() {
  return (
    <>
      <PageHeader icon="grid" title="Home" className="mb-6" />
      <EmptyState icon="calendar-check" title="Welcome to your portal" subtext="Your appointments, records, and messages will appear here." />
    </>
  );
}

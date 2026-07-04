import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

// Placeholder — replaced by the Scheduling agent (task 5).
export default function CalendarPage() {
  return (
    <>
      <PageHeader icon="calendar" title="Calendar" className="mb-6" />
      <EmptyState icon="calendar" title="No appointments yet" subtext="Your schedule will appear here." />
    </>
  );
}

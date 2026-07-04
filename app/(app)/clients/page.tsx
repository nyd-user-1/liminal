import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

// Placeholder — replaced by the Clients/EHR agent (task 6).
export default function ClientsPage() {
  return (
    <>
      <PageHeader icon="users" title="Clients" className="mb-6" />
      <EmptyState icon="users" title="No clients yet" subtext="Your client list will appear here." />
    </>
  );
}

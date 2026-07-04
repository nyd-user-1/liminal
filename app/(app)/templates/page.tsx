import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

// Placeholder — replaced by the Clinical-docs agent (task 7).
export default function TemplatesPage() {
  return (
    <>
      <PageHeader icon="clipboard" title="Templates" className="mb-6" />
      <EmptyState icon="clipboard" title="No templates yet" subtext="Note templates and forms will appear here." />
    </>
  );
}

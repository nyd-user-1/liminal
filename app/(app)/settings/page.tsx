import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

// Placeholder — feature agents add settings sub-pages (services, locations, availability).
export default function SettingsPage() {
  return (
    <>
      <PageHeader icon="gear" title="Settings" className="mb-6" />
      <EmptyState icon="gear" title="Settings" subtext="Practice settings will appear here." />
    </>
  );
}

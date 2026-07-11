import { EmptyState } from "@/components/ui/empty-state";
import { listResponses } from "@/lib/repos/forms";
import { requirePortalClient } from "../data";
import { FormsGrid, type FormCard } from "./forms-grid";

// Portal Forms — the client's assigned forms as a /library-style card grid:
// Pending (Start/Continue → the intake wizard) and Submitted (review).

export const dynamic = "force-dynamic";

export default async function PortalFormsPage() {
  const { client } = await requirePortalClient();
  if (!client) {
    return <EmptyState icon="clipboard" title="No client record is linked to this login" />;
  }

  const responses = await listResponses({ clientId: client.id });
  if (responses.length === 0) {
    return <EmptyState icon="clipboard" title="No forms yet" subtext="Forms your care team sends will appear here." />;
  }

  const toCard = (r: (typeof responses)[number]): FormCard => ({
    id: r.id,
    title: r.formTitle,
    description: r.formDescription,
    status: r.status,
    createdAt: r.createdAt,
    submittedAt: r.submittedAt,
  });

  const pending = responses.filter((r) => r.status !== "submitted").map(toCard);
  const submitted = responses.filter((r) => r.status === "submitted").map(toCard);

  return <FormsGrid pending={pending} submitted={submitted} />;
}

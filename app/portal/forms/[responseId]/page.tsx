import { notFound } from "next/navigation";
import { IntakeWizard } from "@/components/forms/intake-wizard";
import { EmptyState } from "@/components/ui/empty-state";
import { logEvent } from "@/lib/audit";
import { getForm, getResponse } from "@/lib/repos/forms";
import { requirePortalClient } from "../../data";

// Portal intake wizard — fill (or review) one assigned form. Scoped to the
// signed-in client's own responses.

export const dynamic = "force-dynamic";

export default async function PortalFormFillPage({ params }: { params: Promise<{ responseId: string }> }) {
  const { user, client } = await requirePortalClient();
  if (!client) return <EmptyState icon="clipboard" title="No client record is linked to this login" />;

  const { responseId } = await params;
  const response = await getResponse(responseId);
  if (!response || response.clientId !== client.id) notFound();
  const form = await getForm(response.formId);
  if (!form) notFound();

  await logEvent({ actorId: user.id, action: "form_response.view", entity: "form_response", entityId: responseId });

  return <IntakeWizard form={form} response={response} />;
}

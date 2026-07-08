import { notFound } from "next/navigation";
import { FormBuilder } from "@/components/forms/form-builder";
import { getForm } from "@/lib/repos/forms";
import { threadClients } from "@/lib/repos/threads";

// Form builder page — the (app) layout guarantees a practitioner session.

export const dynamic = "force-dynamic";

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [form, clients] = await Promise.all([getForm(id), threadClients()]);
  if (!form) notFound();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <FormBuilder form={form} clients={clients} />
    </div>
  );
}

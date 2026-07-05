import { notFound } from "next/navigation";
import { FormBuilder } from "@/components/forms/form-builder";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageHeader } from "@/components/ui/page-header";
import { getForm } from "@/lib/repos/forms";
import { threadClients } from "@/lib/repos/threads";

// Form builder page — the (app) layout guarantees a practitioner session.

export const dynamic = "force-dynamic";

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [form, clients] = await Promise.all([getForm(id), threadClients()]);
  if (!form) notFound();

  return (
    <>
      <Breadcrumb
        items={[{ label: "Templates", href: "/templates" }, { label: "Forms", href: "/templates/forms" }, { label: form.title }]}
        className="mb-3"
      />
      <PageHeader icon="clipboard" title={form.title} className="mb-6" />
      <FormBuilder form={form} clients={clients} />
    </>
  );
}

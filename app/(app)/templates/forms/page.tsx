import { FormsTemplates } from "@/components/forms/forms-templates";
import { Breadcrumb } from "@/components/ui/breadcrumb";

// Form-template index. `FormsTemplates` is the contract component the
// Templates page (Clinical-docs agent) renders in its Forms tab; this route
// gives it a standalone home at /templates/forms.

export const dynamic = "force-dynamic";

export default function FormsIndexPage() {
  return (
    <>
      <Breadcrumb items={[{ label: "Library", href: "/templates" }, { label: "Forms" }]} className="mb-3" />
      <FormsTemplates />
    </>
  );
}

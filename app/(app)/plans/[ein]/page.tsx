import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getEmployer, getEmployerRateSummary, getPlansForEmployer } from "@/lib/repos/plans";
import { EmployerHeader } from "./employer-header";
import { EmployerTabs } from "./employer-tabs";
import { PlansPanel, RatesPanel } from "./employer-panels";

export const dynamic = "force-dynamic";

export default async function EmployerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ein: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("practitioner");
  const { ein } = await params;
  const { tab } = await searchParams;
  const employer = await getEmployer(ein);
  if (!employer) notFound();

  const [plans, rateSummary] = await Promise.all([
    getPlansForEmployer(ein),
    getEmployerRateSummary(ein),
  ]);

  const networkCount = new Set(plans.map((p) => p.networkProduct).filter(Boolean)).size;

  return (
    <>
      <EmployerHeader employer={employer} networkCount={networkCount} />
      <EmployerTabs
        initialTab={tab}
        tabs={[
          {
            key: "rates",
            label: "Networks & rates",
            count: rateSummary.length || undefined,
            content: <RatesPanel rateSummary={rateSummary} />,
          },
          {
            key: "plans",
            label: "Plans",
            count: plans.length || undefined,
            content: <PlansPanel plans={plans} />,
          },
        ]}
      />
    </>
  );
}

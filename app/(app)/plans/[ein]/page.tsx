import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  CPT_LABELS,
  getEmployer,
  getEmployerRateSummary,
  getEmployerRegistry,
  getPlansForEmployer,
} from "@/lib/repos/plans";
import { EmployerView } from "./employer-view";

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

  const [plans, rateSummary, registry] = await Promise.all([
    getPlansForEmployer(ein),
    getEmployerRateSummary(ein),
    getEmployerRegistry(ein),
  ]);

  return (
    <EmployerView
      employer={employer}
      plans={plans}
      rateSummary={rateSummary}
      registry={registry}
      cptLabels={CPT_LABELS}
      initialTab={tab}
    />
  );
}

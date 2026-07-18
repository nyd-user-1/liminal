"use client";

import type { Employer, EmployerRegistry, NetworkRateSummary, Plan } from "@/lib/repos/plans";
import { EmployerRail } from "./employer-rail";
import { EmployerTabs } from "./employer-tabs";
import { PlansPanel, RatesPanel } from "./employer-panels";

// Employer workspace — the calendar-style split (see the directory's
// ProviderView): a fixed-identity rail beside a flexing content column.
// Networks & rates and Plans stay tabbed rather than stacked — an employer's
// plan list can run into the hundreds of rows post-dedupe, so a fixed split
// would starve one table's own scroll.
export function EmployerView({
  employer,
  plans,
  rateSummary,
  registry,
  cptLabels,
  initialTab,
}: {
  employer: Employer;
  plans: Plan[];
  rateSummary: NetworkRateSummary[];
  registry: EmployerRegistry | null;
  cptLabels: Record<string, string>;
  initialTab?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 lg:flex-row">
      <aside className="min-h-0 lg:h-full lg:w-80 lg:shrink-0">
        <EmployerRail employer={employer} registry={registry} />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <EmployerTabs
          initialTab={initialTab}
          tabs={[
            {
              key: "rates",
              label: "Networks & rates",
              count: rateSummary.length || undefined,
              content: <RatesPanel rateSummary={rateSummary} plans={plans} cptLabels={cptLabels} />,
            },
            {
              key: "plans",
              label: "Plans",
              count: plans.length || undefined,
              content: <PlansPanel plans={plans} employerName={employer.name} />,
            },
          ]}
        />
      </div>
    </div>
  );
}

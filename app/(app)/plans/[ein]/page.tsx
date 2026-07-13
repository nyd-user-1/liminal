import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  CPT_LABELS,
  getEmployer,
  getEmployerRateSummary,
  getPlansForEmployer,
} from "@/lib/repos/plans";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Tr } from "@/components/ui/table";
import { EmployerHeader } from "./employer-header";
import { EmployerTabs } from "./employer-tabs";

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

function RatesPanel({
  rateSummary,
}: {
  rateSummary: Awaited<ReturnType<typeof getEmployerRateSummary>>;
}) {
  if (rateSummary.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="dollar"
          title="No behavioral rates resolved yet"
          subtext="This sponsor's plan files haven't been scanned for behavioral rates, or carry none. Rate coverage grows as more payer files are ingested."
        />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-muted">
        What this sponsor&rsquo;s networks pay for behavioral care, from the payer&rsquo;s own filed
        rates. Medians are deduped across contracts &mdash; a network membership signal, never a
        member&rsquo;s cost.
      </p>
      {rateSummary.map((net) => (
        <Card key={net.networkProduct ?? "—"} className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <div className="font-semibold text-text">{net.networkProduct ?? "—"}</div>
            <Badge variant="neutral">
              {net.providersPriced.toLocaleString()} providers priced
            </Badge>
          </div>
          <Table
            head={["CPT", "Service", "Median in-network rate", "Providers"]}
          >
            {net.cpts.map((c) => (
              <Tr key={c.billingCode}>
                <Td className="font-mono text-[13px] tabular-nums text-text-muted">{c.billingCode}</Td>
                <Td className="text-text-body">{CPT_LABELS[c.billingCode] ?? "—"}</Td>
                <Td className="font-medium tabular-nums text-text">{c.median}</Td>
                <Td className="tabular-nums text-text-body">{c.providers.toLocaleString()}</Td>
              </Tr>
            ))}
          </Table>
        </Card>
      ))}
    </div>
  );
}

function PlansPanel({ plans }: { plans: Awaited<ReturnType<typeof getPlansForEmployer>> }) {
  const inNetwork = plans.filter((p) => p.fileSchema === "IN_NETWORK_RATES");
  const shown = inNetwork.length ? inNetwork : plans;
  if (shown.length === 0) {
    return (
      <Card>
        <EmptyState icon="clipboard" title="No plans on file" />
      </Card>
    );
  }
  return (
    <Table head={["Plan", "Network", "Type", "Published"]}>
      {shown.map((p, i) => (
        <Tr key={`${p.planName}-${p.sourceFile}-${i}`}>
          <Td className="text-text-body">{p.planName}</Td>
          <Td>{p.networkProduct ? <Badge variant="neutral">{p.networkProduct}</Badge> : "—"}</Td>
          <Td className="text-text-muted">{p.fileSchema === "IN_NETWORK_RATES" ? "In-network rates" : p.fileSchema}</Td>
          <Td className="tabular-nums text-text-muted">{p.fileDate ?? "—"}</Td>
        </Tr>
      ))}
    </Table>
  );
}

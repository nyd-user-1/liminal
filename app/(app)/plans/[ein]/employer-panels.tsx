"use client";

import type { NetworkRateSummary, Plan } from "@/lib/repos/plans";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Tr } from "@/components/ui/table";

// Client panels: the table primitive uses hooks, so its consumers must be
// client components (this is the clients-tab pattern). Data arrives fetched +
// serializable from the server page. CPT labels are inlined here rather than
// imported from lib/repos/plans, so the server-only repo module never bundles
// into the client.
const CPT_LABELS: Record<string, string> = {
  "90791": "Diagnostic eval",
  "90834": "Psychotherapy, 45 min",
  "90837": "Psychotherapy, 60 min",
  "90853": "Group psychotherapy",
  "99214": "E/M established",
};

export function RatesPanel({ rateSummary }: { rateSummary: NetworkRateSummary[] }) {
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
          <Table head={["CPT", "Service", "Median in-network rate", "Providers"]}>
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

export function PlansPanel({ plans }: { plans: Plan[] }) {
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
          <Td className="text-text-muted">
            {p.fileSchema === "IN_NETWORK_RATES" ? "In-network rates" : p.fileSchema}
          </Td>
          <Td className="tabular-nums text-text-muted">{p.fileDate ?? "—"}</Td>
        </Tr>
      ))}
    </Table>
  );
}

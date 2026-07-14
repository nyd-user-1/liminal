"use client";

import { useMemo } from "react";
import type { NetworkRateSummary, Plan } from "@/lib/repos/plans";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SortableHead, Table, Td, Tr, useSort } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { prettyNetworkLabel } from "@/lib/format";

// Client panels for the employer workspace's content column (see
// employer-view.tsx). The table primitive uses hooks, so its consumers must
// be client components. Data arrives fetched + serializable from the server
// page, including `cptLabels` (the repo's CPT_LABELS, passed down rather than
// imported here so the server-only repo module never bundles into the
// client).

type RateSortCol = "network" | "plans" | `cpt:${string}`;

interface RateRow {
  networkProduct: string;
  planCount: number;
  cpts: Record<string, string | null>;
}

export function RatesPanel({
  rateSummary,
  plans,
  cptLabels,
}: {
  rateSummary: NetworkRateSummary[];
  plans: Plan[];
  cptLabels: Record<string, string>;
}) {
  const cptCodes = useMemo(() => Object.keys(cptLabels), [cptLabels]);
  const [sort, toggleSort] = useSort<RateSortCol>({ col: "plans", dir: "desc" });

  const rows = useMemo<RateRow[]>(() => {
    return rateSummary.map((net) => {
      const product = net.networkProduct ?? "—";
      const planCount = plans.filter((p) => (p.networkProduct ?? "—") === product).length;
      const cpts: Record<string, string | null> = {};
      for (const c of net.cpts) cpts[c.billingCode] = c.median;
      return { networkProduct: product, planCount, cpts };
    });
  }, [rateSummary, plans]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const money = (v: string | null) => (v == null ? -Infinity : Number(v.slice(1)));
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sort.col === "network") cmp = a.networkProduct.localeCompare(b.networkProduct);
      else if (sort.col === "plans") cmp = a.planCount - b.planCount;
      else cmp = money(a.cpts[sort.col.slice(4)] ?? null) - money(b.cpts[sort.col.slice(4)] ?? null);
      return cmp * dir || a.networkProduct.localeCompare(b.networkProduct);
    });
  }, [rows, sort]);

  if (rows.length === 0) {
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
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-3 shrink-0 text-sm text-text-muted">
        What this sponsor&rsquo;s networks pay for behavioral care, from the payer&rsquo;s own filed
        in-network rates &mdash; a membership signal, deduped across contracts, never a
        member&rsquo;s cost.
      </p>
      <Table
        className="min-h-0 flex-1"
        stickyHeader
        head={[
          <SortableHead key="network" label="Network product" col="network" sort={sort} onSort={toggleSort} />,
          <SortableHead key="plans" label="Plans" col="plans" sort={sort} onSort={toggleSort} />,
          ...cptCodes.map((code) => (
            <Tooltip key={code} label={`${code} · ${cptLabels[code]} · in-network rate`}>
              <SortableHead label={cptLabels[code]} col={`cpt:${code}`} sort={sort} onSort={toggleSort} />
            </Tooltip>
          )),
        ]}
      >
        {sorted.map((r) => (
          <Tr key={r.networkProduct}>
            <Td className="whitespace-nowrap">
              <span className="block max-w-64 truncate font-medium text-text" title={r.networkProduct}>
                {prettyNetworkLabel(r.networkProduct)}
              </span>
            </Td>
            <Td className="tabular-nums text-text-body">{r.planCount}</Td>
            {cptCodes.map((code) => (
              <Td key={code} className="whitespace-nowrap tabular-nums text-text-body">
                {r.cpts[code] ?? "—"}
              </Td>
            ))}
          </Tr>
        ))}
      </Table>
    </div>
  );
}

type PlanSortCol = "plan" | "published";

interface PlanRow {
  planName: string;
  raw: string;
  networkProduct: string | null;
  fileSchema: string | null;
  fileDate: string | null;
  count: number;
}

export function PlansPanel({ plans, employerName }: { plans: Plan[]; employerName: string }) {
  const [sort, toggleSort] = useSort<PlanSortCol>({ col: "plan", dir: "asc" });

  // NYS-44: plan names arrive glued to the employer name in caps
  // ("UNITED AIRLINESAetna Choice POS II") — strip it for display only, then
  // dedupe rows that become identical post-strip into a ×N count.
  const rows = useMemo<PlanRow[]>(() => {
    const inNetwork = plans.filter((p) => p.fileSchema === "IN_NETWORK_RATES");
    const source = inNetwork.length ? inNetwork : plans;
    const groups = new Map<string, PlanRow>();
    for (const p of source) {
      const stripped = stripEmployerPrefix(p.planName, employerName);
      const key = [stripped, p.networkProduct ?? "", p.fileSchema ?? "", p.fileDate ?? ""].join("|");
      const g = groups.get(key);
      if (g) g.count += 1;
      else
        groups.set(key, {
          planName: stripped,
          raw: p.planName,
          networkProduct: p.networkProduct,
          fileSchema: p.fileSchema,
          fileDate: p.fileDate,
          count: 1,
        });
    }
    return [...groups.values()];
  }, [plans, employerName]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const cmp =
        sort.col === "published"
          ? (a.fileDate ?? "").localeCompare(b.fileDate ?? "")
          : a.planName.localeCompare(b.planName);
      return cmp * dir;
    });
  }, [rows, sort]);

  if (sorted.length === 0) {
    return (
      <Card>
        <EmptyState icon="clipboard" title="No plans on file" />
      </Card>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Table
        className="min-h-0 flex-1"
        stickyHeader
        head={[
          <SortableHead key="plan" label="Plan" col="plan" sort={sort} onSort={toggleSort} />,
          "Network",
          "Type",
          <SortableHead key="published" label="Published" col="published" sort={sort} onSort={toggleSort} />,
        ]}
      >
        {sorted.map((r, i) => (
          <Tr key={`${r.planName}|${r.networkProduct}|${r.fileDate}|${i}`}>
            <Td className="whitespace-nowrap text-text-body" title={r.raw}>
              <span className="inline-flex items-center gap-2">
                {r.planName}
                {r.count > 1 && <Badge variant="neutral">×{r.count}</Badge>}
              </span>
            </Td>
            <Td>
              {r.networkProduct ? (
                <Badge variant="neutral">{prettyNetworkLabel(r.networkProduct)}</Badge>
              ) : (
                "—"
              )}
            </Td>
            <Td className="text-text-muted">
              {r.fileSchema === "IN_NETWORK_RATES" ? "In-network rates" : (r.fileSchema ?? "—")}
            </Td>
            <Td className="tabular-nums text-text-muted">{r.fileDate ?? "—"}</Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}

function stripEmployerPrefix(planName: string, employerName: string): string {
  const emp = employerName.trim();
  if (emp && planName.toUpperCase().startsWith(emp.toUpperCase())) {
    return planName.slice(emp.length).trim();
  }
  return planName;
}

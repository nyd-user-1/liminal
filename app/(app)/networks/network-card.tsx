"use client";

import type { ReactNode } from "react";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { RelatedLink, TextLink } from "@/components/ui/text-link";
import type { NetworkListRow, NetworkRateStat, OrgNetworkRatesSummary } from "@/lib/repos/networks";
import { adminLabel, kindLabel } from "./labels";

// The NYS-148 record shape, first live slice: ONE card frame that never moves,
// whose CONTENTS swap between the aggregate shape (the networks object as a
// whole) and the row shape (one canonical network) — the same eight slots,
// different values. The swap always passes through the skeleton state: the
// Code/sports game-log pattern (content-shaped quiet blocks, animate-pulse,
// then the real fill), so the card reads as re-filling, not as a new page.
// Related entities render as dotted RelatedLinks (the crossing signal).

const fmt = (n: number) => n.toLocaleString("en-US");

function Field({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-text-muted" title={title}>
        {label}
      </div>
      <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[15px] text-text">{children}</div>
    </div>
  );
}

/** One pulsing slot, shaped like the field it stands in for (label bar dimmer
 *  and narrower than the value bar — the sports loading.tsx composition). */
function FieldSkeleton({ w }: { w: string }) {
  return (
    <div>
      <div className="h-3 w-16 animate-pulse rounded bg-border/60" />
      <div className={`mt-2.5 h-4 animate-pulse rounded bg-border ${w}`} />
    </div>
  );
}

const SKELETON_WIDTHS = ["w-40", "w-24", "w-28", "w-32", "w-20", "w-24", "w-36", "w-44"];

export function NetworkIdentityCard({
  focus,
  loading,
  all,
  orgStats,
  summary,
  onClear,
}: {
  /** The focused row, or null for the aggregate view. */
  focus: NetworkListRow | null;
  /** True while the skeleton transition plays. */
  loading: boolean;
  all: NetworkListRow[];
  orgStats: Record<string, NetworkRateStat>;
  summary: OrgNetworkRatesSummary | null;
  onClear: () => void;
}) {
  const insurers = new Set(all.map((n) => n.insurer)).size;
  const admins = new Set(all.filter((n) => n.administrator).map((n) => n.administrator)).size;
  const nets = all.filter((n) => n.kind === "network").length;
  const stat = focus ? orgStats[focus.id] : undefined;
  const dot = <span className="text-text-muted">·</span>;

  return (
    <div className="relative shrink-0 rounded-card bg-canvas px-6 py-5">
      {focus && !loading && (
        <div className="absolute right-5 top-4">
          <TextLink onClick={onClear}>All networks</TextLink>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">
        {loading ? (
          SKELETON_WIDTHS.map((w, i) => <FieldSkeleton key={i} w={w} />)
        ) : focus ? (
          <>
            <Field label="Network">
              <span className="truncate font-medium" title={focus.name}>
                {focus.name}
              </span>
            </Field>
            <Field label="Insurer">
              <InsurerMark payer={focus.insurer} />
              <RelatedLink href={`/insurers/${focus.insurerId}`} title={`Open ${focus.insurer}`}>
                <span className="truncate">{focus.insurer}</span>
              </RelatedLink>
            </Field>
            <Field label="Administrator">{adminLabel(focus)}</Field>
            <Field label="Type">{kindLabel(focus)}</Field>
            <Field label="Orgs priced" title="Organizations with an attested 90837 rate in this network">
              {stat?.orgs ? fmt(stat.orgs) : <span className="text-text-muted">No rates</span>}
            </Field>
            <Field label="As of">{stat?.asOf ?? <span className="text-text-muted">No attestations</span>}</Field>
            <Field label="Notes">
              {focus.notes ? (
                <span className="truncate text-text-body" title={focus.notes}>
                  {focus.notes}
                </span>
              ) : (
                <span className="text-text-muted">No notes</span>
              )}
            </Field>
            <Field label="Connections">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <RelatedLink href={`/insurers/${focus.insurerId}`} title={`Open ${focus.insurer}`}>
                  {focus.insurer}
                </RelatedLink>
                {dot}
                <RelatedLink href="/orgs" title="Organizations billing in this network">
                  Organizations
                </RelatedLink>
                {dot}
                <RelatedLink href="/rates" title="Published rates">
                  Rates
                </RelatedLink>
              </span>
            </Field>
          </>
        ) : (
          <>
            <Field label="Networks">{fmt(all.length)} canonical</Field>
            <Field label="Insurers">{fmt(insurers)}</Field>
            <Field label="Administrators">{fmt(admins)} TPAs</Field>
            <Field label="Types">
              {fmt(nets)} networks {dot} {fmt(all.length - nets)} products
            </Field>
            <Field label="Orgs priced" title="Distinct billing organizations with any attested rate (sql/048)">
              {summary ? fmt(summary.orgs) : <span className="text-text-muted">—</span>}
            </Field>
            <Field label="As of">{summary?.asOf ?? <span className="text-text-muted">No attestations</span>}</Field>
            <Field label="Resolved rates" title="org × network × code leaves in org_network_rates">
              {summary ? (
                <>
                  {fmt(summary.leaves)} {dot} {summary.singleRatePct}% single-rate
                </>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </Field>
            <Field label="Connections">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <RelatedLink href="/insurers" title="Canonical insurers">
                  Insurers
                </RelatedLink>
                {dot}
                <RelatedLink href="/orgs" title="Billing organizations">
                  Organizations
                </RelatedLink>
                {dot}
                <RelatedLink href="/plans" title="Employer plans">
                  Plans
                </RelatedLink>
                {dot}
                <RelatedLink href="/rates" title="Published rates">
                  Rates
                </RelatedLink>
              </span>
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

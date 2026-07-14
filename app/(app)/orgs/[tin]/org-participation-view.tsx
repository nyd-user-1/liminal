"use client";

import { Badge } from "@/components/ui/badge";
import { Table, Td, Tr } from "@/components/ui/table";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { prettyNetworkLabel } from "@/lib/format";
import type { OrgParticipationRow } from "@/lib/repos/orgs";

// Presentational half of the network-participation panel — a client component
// because the Table primitive carries hooks. The async fetch lives in the
// server wrapper (org-participation.tsx), which streams this in via Suspense.

const HEAD = ["Insurer", "Network", "Clinicians", "Accepting new patients"];

function Heading() {
  return (
    <>
      <h2 className="text-[17px] font-semibold text-text">Network participation</h2>
      <p className="mt-1 max-w-2xl text-sm text-text-muted">
        Independent membership evidence from payer directories. &ldquo;Accepting new patients&rdquo; is a liveness
        signal the rate files above can&rsquo;t carry.
      </p>
    </>
  );
}

export function OrgParticipationFallback() {
  return (
    <section>
      <Heading />
      <div className="mt-4">
        <TableSkeleton head={HEAD} />
      </div>
    </section>
  );
}

export function OrgParticipationView({ rows }: { rows: OrgParticipationRow[] }) {
  return (
    <section>
      <Heading />
      {rows.length === 0 ? (
        <p className="mt-4 rounded-card border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted shadow-card">
          None of this organization&rsquo;s clinicians are listed in a payer directory we&rsquo;ve harvested. That is
          not evidence of non-participation — many payers block or omit directory pulls.
        </p>
      ) : (
        <Table className="mt-4" head={HEAD}>
          {rows.map((r, i) => (
            <Tr key={`${r.payer}|${r.network}|${i}`}>
              <Td className="whitespace-nowrap">
                <span className="flex items-center gap-2.5">
                  <InsurerMark payer={r.payer} />
                  <span className="max-w-48 truncate font-medium text-text" title={r.payer}>
                    {r.payer}
                  </span>
                </span>
              </Td>
              <Td>
                <span className="block max-w-56 truncate" title={r.network}>
                  {prettyNetworkLabel(r.network)}
                </span>
              </Td>
              <Td className="whitespace-nowrap tabular-nums text-text-body">{r.npis.toLocaleString()}</Td>
              <Td className="whitespace-nowrap">
                {r.accepting > 0 ? (
                  <Badge variant="success" className="!font-normal">
                    {r.accepting.toLocaleString()} accepting
                  </Badge>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </section>
  );
}

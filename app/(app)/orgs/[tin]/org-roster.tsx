"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, Td, Tr } from "@/components/ui/table";
import { titleCase } from "@/lib/format";
import type { OrgRosterRow } from "@/lib/repos/orgs";

// The org's roster — its NPIs, enriched from our directory where we know them.
// Server-renders the first page; "Show more" pages via /api/orgs/roster
// (Headway alone is 13,614 rows). Providers we recognize link to their
// directory profile; NPIs we don't hold render bare (we never invent identity).

const PAGE = 50;

export function OrgRoster({
  tin,
  initial,
  total,
  clinicians,
}: {
  tin: string;
  initial: OrgRosterRow[];
  total: number;
  clinicians: number;
}) {
  const [rows, setRows] = useState<OrgRosterRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const hasMore = rows.length < total;

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/roster?tin=${encodeURIComponent(tin)}&offset=${rows.length}&limit=${PAGE}`);
      const data = await res.json();
      setRows((prev) => [...prev, ...((data.rows ?? []) as OrgRosterRow[])]);
    } catch {
      /* leave the list as-is; the button stays available to retry */
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-text">Roster</h2>
        <span className="text-sm text-text-muted">
          {clinicians.toLocaleString()} clinician{clinicians === 1 ? "" : "s"}
        </span>
      </div>

      <Table className="mt-4" head={["Provider", "Discipline", "City", "Payers", "Last seen"]}>
        {rows.map((r) => (
          <Tr key={r.npi}>
            <Td className="max-w-80">
              {r.name ? (
                <Link
                  href={`/directory/providers/${r.npi}`}
                  className="block max-w-full truncate font-medium text-primary hover:underline"
                  title={titleCase(r.name)}
                >
                  {titleCase(r.name)}
                </Link>
              ) : (
                <span className="tabular-nums text-text-muted" title="Not in our directory">
                  {r.npi}
                </span>
              )}
            </Td>
            <Td className="whitespace-nowrap text-text-body">{r.profession ? titleCase(r.profession) : "—"}</Td>
            <Td className="whitespace-nowrap text-text-body">{r.city ? titleCase(r.city) : "—"}</Td>
            <Td className="whitespace-nowrap tabular-nums text-text-body">{r.payerCount}</Td>
            <Td className="whitespace-nowrap text-text-muted">{r.lastFileDate ?? "—"}</Td>
          </Tr>
        ))}
      </Table>

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex h-10 items-center rounded-field border border-field-border px-4 text-sm font-medium text-text-body transition-colors hover:border-field-border-focus disabled:opacity-60"
          >
            {loading ? "Loading…" : `Show more (${(total - rows.length).toLocaleString()} left)`}
          </button>
        </div>
      )}
    </section>
  );
}

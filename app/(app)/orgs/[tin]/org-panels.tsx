"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Icon } from "@/components/ui/icons";
import { LoadMoreRow, Table, Td, Tr, useSentinel } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { cptLabel } from "@/components/rates/cpt";
import { prettyNetworkLabel, titleCase } from "@/lib/format";
import type { OrgParticipationRow, OrgRateBand, OrgRosterRow } from "@/lib/repos/orgs";

// The org workspace's content column — same shape as the provider drill-down's
// ProviderRates: toggle chips over a SINGLE table that owns its scroll
// (min-h-0 flex-1, sticky header), so the page itself never moves. Three views:
// per-insurer rate economics, roster, and directory participation.

const CPT_ORDER = ["90791", "90792", "90834", "90837", "90853", "99213", "99214", "99215"];
const cptRank = (c: string) => {
  const i = CPT_ORDER.indexOf(c);
  return i === -1 ? CPT_ORDER.length : i;
};
const usd = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
const ROSTER_PAGE = 50;

type View = "rates" | "roster" | "participation";

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center rounded-field border px-4 text-sm font-medium transition-colors ${
        active ? "border-primary bg-primary-wash text-primary" : "border-field-border text-text-body hover:border-field-border-focus"
      }`}
    >
      {children}
    </button>
  );
}

export function OrgPanels({
  tin,
  rates,
  rosterInitial,
  rosterTotal,
}: {
  tin: string;
  rates: OrgRateBand[];
  rosterInitial: OrgRosterRow[];
  rosterTotal: number;
}) {
  const [view, setView] = useState<View>("rates");

  // Rates: group by insurer, insurer shown once per group, codes canonical.
  const rateGroups = useMemo(() => {
    const byPayer = new Map<string, OrgRateBand[]>();
    for (const r of rates) {
      const g = byPayer.get(r.payer);
      if (g) g.push(r);
      else byPayer.set(r.payer, [r]);
    }
    return [...byPayer.entries()]
      .map(([payer, rows]) => ({
        payer,
        rows: [...rows].sort((a, b) => cptRank(a.billingCode) - cptRank(b.billingCode) || a.billingCode.localeCompare(b.billingCode)),
        maxNpis: Math.max(...rows.map((r) => r.npis)),
      }))
      .sort((a, b) => b.maxNpis - a.maxNpis || a.payer.localeCompare(b.payer));
  }, [rates]);

  // Roster: lazy-append pages (Headway alone is 13,614 rows).
  const [roster, setRoster] = useState<OrgRosterRow[]>(rosterInitial);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const rosterHasMore = roster.length < rosterTotal;
  async function loadMoreRoster() {
    if (loadingRoster) return;
    setLoadingRoster(true);
    try {
      const res = await fetch(`/api/orgs/roster?tin=${encodeURIComponent(tin)}&offset=${roster.length}&limit=${ROSTER_PAGE}`);
      const data = await res.json();
      setRoster((prev) => [...prev, ...((data.rows ?? []) as OrgRosterRow[])]);
    } catch {
      /* leave the list; sentinel re-fires on next scroll */
    } finally {
      setLoadingRoster(false);
    }
  }
  const rosterSentinel = useSentinel(loadMoreRoster, view === "roster" && rosterHasMore && !loadingRoster);

  // Participation: lazy-load on first view (heavy join).
  const [participation, setParticipation] = useState<OrgParticipationRow[] | null>(null);
  const partReq = useRef(false);
  useEffect(() => {
    if (view !== "participation" || participation !== null || partReq.current) return;
    partReq.current = true;
    fetch(`/api/orgs/participation?tin=${encodeURIComponent(tin)}`)
      .then((r) => r.json())
      .then((d) => setParticipation((d.rows ?? []) as OrgParticipationRow[]))
      .catch(() => setParticipation([]));
  }, [view, participation, tin]);

  return (
    <>
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <ToggleChip active={view === "rates"} onClick={() => setView("rates")}>
          Rates
        </ToggleChip>
        <ToggleChip active={view === "roster"} onClick={() => setView("roster")}>
          Roster
        </ToggleChip>
        <ToggleChip active={view === "participation"} onClick={() => setView("participation")}>
          Participation
        </ToggleChip>
      </div>

      {view === "rates" ? (
        rateGroups.length === 0 ? (
          <Banner variant="info">
            No dollar-denominated rate rows for this organization — its contracts may all be percentage-of-charge.
          </Banner>
        ) : (
          <Table
            className="min-h-0 flex-1"
            stickyHeader
            head={[
              "Insurer",
              "Code",
              "Clinicians",
              "25th",
              <Tooltip
                key="median"
                label="Median in-network rate the payer pays this organization's clinicians — payer→provider, not patient cost."
              >
                <span className="inline-flex cursor-help items-center gap-1">
                  Median <Icon name="info" size={13} className="text-text-muted" />
                </span>
              </Tooltip>,
              "75th",
              "As-of",
            ]}
          >
            {rateGroups.flatMap((g) =>
              g.rows.map((r, i) => (
                <Tr key={`${g.payer}|${r.billingCode}`} className={i === 0 ? "border-t-2 border-t-border" : ""}>
                  <Td className="whitespace-nowrap">
                    {i === 0 ? (
                      <span className="flex items-center gap-2.5">
                        <InsurerMark payer={g.payer} />
                        <span className="max-w-48 truncate font-medium text-text" title={g.payer}>
                          {g.payer}
                        </span>
                      </span>
                    ) : (
                      <span className="sr-only">{g.payer}</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap" title={cptLabel(r.billingCode)}>
                    <span className="tabular-nums">{r.billingCode}</span>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-text-body">{r.npis.toLocaleString()}</Td>
                  <Td className="whitespace-nowrap tabular-nums text-text-muted">{usd(r.p25)}</Td>
                  <Td className="whitespace-nowrap tabular-nums font-medium text-text">{usd(r.median)}</Td>
                  <Td className="whitespace-nowrap tabular-nums text-text-muted">{usd(r.p75)}</Td>
                  <Td className="whitespace-nowrap text-text-muted">{r.asOf}</Td>
                </Tr>
              )),
            )}
          </Table>
        )
      ) : view === "roster" ? (
        <Table className="min-h-0 flex-1" stickyHeader head={["Provider", "Discipline", "City", "Payers", "Last seen"]}>
          {roster.map((r) => (
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
          {rosterHasMore && <LoadMoreRow sentinelRef={rosterSentinel} colSpan={5} />}
        </Table>
      ) : participation === null ? (
        <TableSkeleton head={["Insurer", "Network", "Clinicians", "Accepting new patients"]} />
      ) : participation.length === 0 ? (
        <Banner variant="info">
          None of this organization&rsquo;s clinicians are listed in a payer directory we&rsquo;ve harvested — not evidence
          of non-participation (many payers block or omit directory pulls).
        </Banner>
      ) : (
        <Table className="min-h-0 flex-1" stickyHeader head={["Insurer", "Network", "Clinicians", "Accepting new patients"]}>
          {participation.map((r, i) => (
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
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { cptLabel } from "@/components/rates/cpt";
import { prettyNetworkLabel, titleCase } from "@/lib/format";
import type { OrgParticipationRow, OrgRateBand, OrgRosterRow } from "@/lib/repos/orgs";
import type { OrgGraph } from "@/lib/org-graph";

// The org workspace's content column — toggle chips over a single view. Four
// views: roster, per-insurer rate economics, directory participation, and the
// relationship Map (React Flow — dynamically imported so @xyflow/react stays
// out of every other bundle). Every table is the DataTable standard (same
// anatomy as /directory and the /orgs index): TextLink identity links,
// select column where rows are entities, and an honest source + freshness
// footer on each.

const OrgMap = dynamic(() => import("./org-map").then((m) => m.OrgMap), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <Spinner size={22} className="text-text-muted" />
    </div>
  ),
});

const CPT_ORDER = ["90791", "90792", "90834", "90837", "90853", "99213", "99214", "99215"];
const cptRank = (c: string) => {
  const i = CPT_ORDER.indexOf(c);
  return i === -1 ? CPT_ORDER.length : i;
};
const usd = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
const ROSTER_PAGE = 50;

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

type View = "rates" | "roster" | "participation" | "map";

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

// One flat row type for the rates TREE: an insurer group opens to its per-code
// bands in the same columns (the /published-rates pattern).
type RateTreeRow =
  | { group: true; payer: string; bands: OrgRateBand[]; maxNpis: number; medPaid: number; asOf: string }
  | { group: false; payer: string; band: OrgRateBand };

const rateRowKey = (r: RateTreeRow) => (r.group ? `g:${r.payer}` : `b:${r.payer}|${r.band.billingCode}`);

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
  const router = useRouter();
  const [view, setView] = useState<View>("roster");

  // ── Rates: insurer groups → per-code band children ──────────────────────────
  const rateGroups = useMemo<RateTreeRow[]>(() => {
    const byPayer = new Map<string, OrgRateBand[]>();
    for (const r of rates) {
      const g = byPayer.get(r.payer);
      if (g) g.push(r);
      else byPayer.set(r.payer, [r]);
    }
    return [...byPayer.entries()].map(([payer, bands]) => ({
      group: true as const,
      payer,
      bands: [...bands].sort((a, b) => cptRank(a.billingCode) - cptRank(b.billingCode) || a.billingCode.localeCompare(b.billingCode)),
      maxNpis: Math.max(...bands.map((r) => r.npis)),
      medPaid: median(bands.map((r) => r.median ?? 0)),
      asOf: bands.reduce((m, r) => (r.asOf > m ? r.asOf : m), ""),
    }));
  }, [rates]);
  const rateChildren = useMemo(() => {
    const m = new Map<string, RateTreeRow[]>();
    for (const g of rateGroups) {
      if (g.group) m.set(g.payer, g.bands.map((band) => ({ group: false as const, payer: g.payer, band })));
    }
    return m;
  }, [rateGroups]);
  const ratesAsOf = rateGroups.reduce((m, g) => (g.group && g.asOf > m ? g.asOf : m), "");

  const rateColumns: DataTableColumn<RateTreeRow>[] = [
    {
      key: "insurer",
      label: "Insurer",
      fixed: true,
      sortValue: (r) => r.payer,
      render: (r) =>
        r.group ? (
          <span className="flex items-center gap-2">
            <InsurerMark payer={r.payer} />
            <span className="max-w-44 truncate font-semibold text-text" title={r.payer}>
              {r.payer}
            </span>
          </span>
        ) : (
          ""
        ),
    },
    {
      key: "code",
      label: "Code",
      render: (r) =>
        r.group ? "" : (
          <span className="tabular-nums" title={cptLabel(r.band.billingCode)}>
            {r.band.billingCode}
          </span>
        ),
    },
    {
      key: "clinicians",
      label: "Clinicians",
      sortValue: (r) => (r.group ? r.maxNpis : r.band.npis),
      render: (r) => (r.group ? "" : <span className="tabular-nums text-text-body">{r.band.npis.toLocaleString()}</span>),
    },
    {
      key: "median",
      label: "Median paid",
      headTitle: "Median in-network rate the payer pays this organization's clinicians — payer→provider, not patient cost.",
      sortValue: (r) => (r.group ? r.medPaid : r.band.median ?? 0),
      render: (r) => (r.group ? "" : <span className="tabular-nums font-medium text-text">{usd(r.band.median)}</span>),
    },
    {
      key: "asOf",
      label: "As-of",
      sortValue: (r) => (r.group ? r.asOf : r.band.asOf),
      render: (r) => (r.group ? "" : <span className="text-text-muted">{r.band.asOf}</span>),
    },
  ];

  // ── Roster: server-paged; grows on scroll ───────────────────────────────────
  const [roster, setRoster] = useState<OrgRosterRow[]>(rosterInitial);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSelected, setRosterSelected] = useState<Set<string>>(new Set());
  const rosterHasMore = roster.length < rosterTotal;
  async function loadMoreRoster() {
    if (loadingRoster) return;
    setLoadingRoster(true);
    try {
      const res = await fetch(`/api/orgs/roster?tin=${encodeURIComponent(tin)}&offset=${roster.length}&limit=${ROSTER_PAGE}`);
      const data = await res.json();
      setRoster((prev) => [...prev, ...((data.rows ?? []) as OrgRosterRow[])]);
    } catch {
      /* leave the list; the sentinel re-fires on next scroll */
    } finally {
      setLoadingRoster(false);
    }
  }

  const rosterColumns: DataTableColumn<OrgRosterRow>[] = [
    {
      key: "name",
      label: "Provider",
      fixed: true,
      // Unnamed rows (bare NPIs) sort to the bottom of a name sort.
      sortValue: (r) => (r.name ? titleCase(r.name) : "￿"),
      cellClassName: "max-w-80",
      render: (r) =>
        r.name ? (
          <TextLink
            href={`/directory/providers/${r.npi}`}
            variant="name"
            title={titleCase(r.name)}
            className="min-w-0 max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="block truncate">{titleCase(r.name)}</span>
          </TextLink>
        ) : (
          <span className="tabular-nums text-text-muted" title="Not in our directory">
            {r.npi}
          </span>
        ),
    },
    {
      key: "discipline",
      label: "Discipline",
      sortValue: (r) => r.profession ?? "",
      render: (r) => <span className="text-text-body">{r.profession ? titleCase(r.profession) : "—"}</span>,
    },
    {
      key: "city",
      label: "City",
      sortValue: (r) => r.city ?? "",
      render: (r) => <span className="text-text-body">{r.city ? titleCase(r.city) : "—"}</span>,
    },
    {
      key: "payers",
      label: "Payers",
      sortValue: (r) => r.payerCount,
      render: (r) => <span className="tabular-nums text-text-body">{r.payerCount}</span>,
    },
    {
      key: "seen",
      label: "Last seen",
      sortValue: (r) => r.lastFileDate ?? "",
      render: (r) => <span className="text-text-muted">{r.lastFileDate ?? "—"}</span>,
    },
  ];

  // ── Participation: lazy-load on first view (heavy join) ─────────────────────
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

  const participationColumns: DataTableColumn<OrgParticipationRow>[] = [
    {
      key: "insurer",
      label: "Insurer",
      fixed: true,
      sortValue: (r) => r.payer,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <InsurerMark payer={r.payer} />
          <span className="max-w-48 truncate font-medium text-text" title={r.payer}>
            {r.payer}
          </span>
        </span>
      ),
    },
    {
      key: "network",
      label: "Network",
      sortValue: (r) => r.network,
      cellClassName: "max-w-56",
      render: (r) => (
        <span className="block truncate" title={r.network}>
          {prettyNetworkLabel(r.network)}
        </span>
      ),
    },
    {
      key: "clinicians",
      label: "Clinicians",
      sortValue: (r) => r.npis,
      render: (r) => <span className="tabular-nums text-text-body">{r.npis.toLocaleString()}</span>,
    },
    {
      key: "accepting",
      label: "Accepting new patients",
      sortValue: (r) => r.accepting,
      render: (r) =>
        r.accepting > 0 ? (
          <Badge variant="success" className="!font-normal">
            {r.accepting.toLocaleString()} accepting
          </Badge>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
  ];

  // ── Map: lazy-load the graph on first view ──────────────────────────────────
  const [graph, setGraph] = useState<OrgGraph | null>(null);
  const [graphFailed, setGraphFailed] = useState(false);
  const graphReq = useRef(false);
  useEffect(() => {
    if (view !== "map" || graph !== null || graphReq.current) return;
    graphReq.current = true;
    fetch(`/api/orgs/graph?tin=${encodeURIComponent(tin)}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => setGraph(d as OrgGraph))
      .catch(() => setGraphFailed(true));
  }, [view, graph, tin]);

  return (
    <>
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <ToggleChip active={view === "roster"} onClick={() => setView("roster")}>
          Roster
        </ToggleChip>
        <ToggleChip active={view === "rates"} onClick={() => setView("rates")}>
          Rates
        </ToggleChip>
        <ToggleChip active={view === "participation"} onClick={() => setView("participation")}>
          Participation
        </ToggleChip>
        <ToggleChip active={view === "map"} onClick={() => setView("map")}>
          Map
        </ToggleChip>
      </div>

      {view === "map" ? (
        graphFailed ? (
          <Banner variant="info">The relationship map didn&rsquo;t load — reload the page to try again.</Banner>
        ) : graph === null ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Spinner size={22} className="text-text-muted" />
          </div>
        ) : (
          <OrgMap graph={graph} onShowRoster={() => setView("roster")} />
        )
      ) : view === "rates" ? (
        rateGroups.length === 0 ? (
          <Banner variant="info">
            No dollar-denominated rate rows for this organization — its contracts may all be percentage-of-charge.
          </Banner>
        ) : (
          <DataTable
            // Distinct keys per view: the three views render a DataTable at the
            // SAME tree position, so without keys React would update one mounted
            // instance across view switches and its state (expanded set, sort)
            // would leak from view to view — initialExpanded would never re-run.
            key="rates"
            columns={rateColumns}
            rows={rateGroups}
            rowKey={rateRowKey}
            subRows={(r) => (r.group ? rateChildren.get(r.payer) : undefined)}
            isSubRow={(r) => !r.group}
            initialExpanded="all"
            defaultSort={{ col: "clinicians", dir: "desc" }}
            fillHeight
            className="min-h-0 flex-1"
            records={rates.length}
            updatedDate={ratesAsOf || null}
          />
        )
      ) : view === "roster" ? (
        <DataTable
          key="roster"
          columns={rosterColumns}
          rows={roster}
          rowKey={(r) => r.npi}
          defaultSort={{ col: "name", dir: "asc" }}
          fillHeight
          className="min-h-0 flex-1"
          selected={rosterSelected}
          onSelectedChange={setRosterSelected}
          onEndReached={rosterHasMore ? loadMoreRoster : undefined}
          rowActions={(r) =>
            r.name ? (
              <KebabMenu label={`Actions for ${titleCase(r.name)}`}>
                <MenuItem
                  icon="person-circle"
                  label="Open provider"
                  onClick={() => router.push(`/directory/providers/${r.npi}`)}
                />
              </KebabMenu>
            ) : null
          }
          records={rosterTotal}
          updatedDate={roster.reduce<string | null>((m, r) => (r.lastFileDate && (!m || r.lastFileDate > m) ? r.lastFileDate : m), null)}
        />
      ) : participation === null ? (
        <TableSkeleton head={["Insurer", "Network", "Clinicians", "Accepting new patients"]} />
      ) : participation.length === 0 ? (
        <Banner variant="info">
          None of this organization&rsquo;s clinicians are listed in a payer directory we&rsquo;ve harvested — not evidence
          of non-participation (many payers block or omit directory pulls).
        </Banner>
      ) : (
        <DataTable
          key="participation"
          columns={participationColumns}
          rows={participation}
          rowKey={(r) => `${r.payer}|${r.network}`}
          defaultSort={{ col: "clinicians", dir: "desc" }}
          fillHeight
          className="min-h-0 flex-1"
          records={participation.length}
        />
      )}
    </>
  );
}

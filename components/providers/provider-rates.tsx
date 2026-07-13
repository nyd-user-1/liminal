"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { ColumnPicker } from "@/components/ui/column-picker";
import { Icon } from "@/components/ui/icons";
import { SortableHead, Table, Td, Tr, useSort } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { cptLabel } from "@/components/rates/cpt";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import { prettyNetworkLabel } from "@/lib/format";
import type { NetworkMembershipRow, ProviderRateRow } from "@/lib/repos/rate-directory";

// The provider Overview pane's right side. Default view = NETWORKS: one row
// per insurer × network, both federal sources outer-joined (directory rows
// carry Accepting/Updated, price-file rows carry best per-session rates per
// scanned code; rows merge only on exact payer+network match — see
// listNetworkMemberships). "All rates" keeps the per-CPT table one click
// away. "Updated" = the payer's own last-published/effective date — it is
// NOT a row-creation date.

// Scanned CPT codes → short column labels. 90834 is FORTY-FIVE minutes —
// there is no 30-minute code (90832) in the scan set yet.
const RATE_COLS = [
  { key: "b90791", label: "Eval", tip: "90791 · Psychiatric diagnostic evaluation" },
  { key: "b90834", label: "45 Min", tip: "90834 · 45-minute psychotherapy" },
  { key: "b90837", label: "60 Min", tip: "90837 · 60-minute psychotherapy" },
  { key: "b90853", label: "Group", tip: "90853 · Group psychotherapy" },
  { key: "b99214", label: "Mgmt", tip: "99214 · Med management, established patient" },
] as const;
type RateColKey = (typeof RATE_COLS)[number]["key"];

const NETWORK_COLUMNS = [
  { key: "network", label: "Network" },
  { key: "accepting", label: "Accepting" },
  { key: "updated", label: "Updated" },
  ...RATE_COLS.map((c) => ({ key: c.key, label: c.label })),
];

type MemberCol = "insurer" | "network" | "accepting" | "updated" | RateColKey;

const RATE_FIELD: Record<RateColKey, keyof NetworkMembershipRow> = {
  b90791: "best90791",
  b90834: "best90834",
  b90837: "best90837",
  b90853: "best90853",
  b99214: "best99214",
};

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-field border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-primary bg-primary-wash text-primary" : "border-field-border text-text-body hover:border-field-border-focus"
      }`}
    >
      {children}
    </button>
  );
}

export function ProviderRates({ npi }: { npi: string | null }) {
  const [rates, setRates] = useState<ProviderRateRow[] | null>(null);
  const [memberships, setMemberships] = useState<NetworkMembershipRow[] | null>(null);
  const [view, setView] = useState<"networks" | "rates">("networks");
  const [sort, toggleSort] = useSort<MemberCol>({ col: "insurer", dir: "asc" });

  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(NETWORK_COLUMNS.map((c) => c.key)));
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("provider.rates.columns") ?? "null");
      if (Array.isArray(saved)) setVisibleCols(new Set(saved));
    } catch {
      /* corrupt storage — keep defaults */
    }
  }, []);
  function toggleCol(key: string) {
    setVisibleCols((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem("provider.rates.columns", JSON.stringify([...next]));
      return next;
    });
  }
  const vis = (k: string) => visibleCols.has(k);

  useEffect(() => {
    if (!npi) {
      setRates([]);
      setMemberships([]);
      return;
    }
    let stale = false;
    fetch(`/api/directory/provider-rates?npi=${npi}`)
      .then((res) => res.json())
      .then((data) => {
        if (stale) return;
        setRates(data.rates ?? []);
        setMemberships(data.memberships ?? []);
      })
      .catch(() => {
        if (stale) return;
        setRates([]);
        setMemberships([]);
      });
    return () => {
      stale = true;
    };
  }, [npi]);

  const sortedMembers = useMemo(() => {
    if (!memberships) return [];
    const dir = sort.dir === "asc" ? 1 : -1;
    const money = (v: string | null) => (v == null ? -Infinity : Number(v.slice(1)));
    const accRank = (m: NetworkMembershipRow) =>
      m.accepting === "accepting" ? 2 : m.accepting === "not_accepting" ? 1 : 0;
    return [...memberships].sort((a, b) => {
      let cmp = 0;
      if (sort.col === "network") cmp = a.network.localeCompare(b.network);
      else if (sort.col === "accepting") cmp = accRank(a) - accRank(b);
      else if (sort.col === "updated") cmp = (a.asOf ?? "").localeCompare(b.asOf ?? "");
      else if (sort.col in RATE_FIELD)
        cmp = money(a[RATE_FIELD[sort.col as RateColKey]] as string | null) - money(b[RATE_FIELD[sort.col as RateColKey]] as string | null);
      else cmp = a.payer.localeCompare(b.payer);
      return cmp * dir || a.payer.localeCompare(b.payer) || a.network.localeCompare(b.network);
    });
  }, [memberships, sort]);

  if (rates === null || memberships === null)
    return <TableSkeleton head={["Insurer", "Network", "Accepting", "Updated", ...RATE_COLS.map((c) => c.label)]} />;

  if (memberships.length === 0) {
    return (
      <Banner variant="info">
        No network listings or published rate rows for this provider — which is{" "}
        <span className="font-semibold">not</span> the same as not being in-network. Some payers block
        rate-file pulls, and clinicians with out-of-state practice addresses are missing from NY files.
      </Banner>
    );
  }

  return (
    <>
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <ToggleChip active={view === "networks"} onClick={() => setView("networks")}>
          Networks
        </ToggleChip>
        <ToggleChip active={view === "rates"} onClick={() => setView("rates")}>
          All rates
        </ToggleChip>
        {view === "networks" && (
          <ColumnPicker options={NETWORK_COLUMNS} visible={visibleCols} onToggle={toggleCol} className="ml-auto" />
        )}
      </div>

      {view === "networks" ? (
        <Table
          className="min-h-0 flex-1"
          stickyHeader
          head={[
            <SortableHead key="insurer" label="Insurer" col="insurer" sort={sort} onSort={toggleSort} />,
            ...(vis("network")
              ? [<SortableHead key="network" label="Network" col="network" sort={sort} onSort={toggleSort} />]
              : []),
            ...(vis("accepting")
              ? [<SortableHead key="accepting" label="Accepting" col="accepting" sort={sort} onSort={toggleSort} />]
              : []),
            ...(vis("updated")
              ? [<SortableHead key="updated" label="Updated" col="updated" sort={sort} onSort={toggleSort} />]
              : []),
            ...RATE_COLS.filter((c) => vis(c.key)).map((c) => (
              <Tooltip key={c.key} label={c.tip}>
                <SortableHead label={c.label} col={c.key} sort={sort} onSort={toggleSort} />
              </Tooltip>
            )),
          ]}
        >
          {sortedMembers.map((m, i) => (
            <Tr key={`${m.payer}|${m.network}|${i}`}>
              <Td className="whitespace-nowrap">
                <span className="flex items-center gap-2.5">
                  <InsurerMark payer={m.payer} />
                  <span className="max-w-48 truncate font-medium text-text" title={m.payer}>
                    {m.payer}
                  </span>
                </span>
              </Td>
              {vis("network") && (
                <Td>
                  <span className="block max-w-64 truncate" title={m.network || undefined}>
                    {m.network ? prettyNetworkLabel(m.network) : <span className="text-text-muted">Listed (no network detail)</span>}
                  </span>
                </Td>
              )}
              {vis("accepting") && (
                <Td className="whitespace-nowrap">
                  {m.accepting === "accepting" ? (
                    <Badge variant="success">Accepting</Badge>
                  ) : m.accepting === "not_accepting" ? (
                    <Badge variant="neutral">Not accepting</Badge>
                  ) : (
                    "—"
                  )}
                </Td>
              )}
              {vis("updated") && <Td className="whitespace-nowrap text-text-muted">{m.asOf ?? "—"}</Td>}
              {RATE_COLS.filter((c) => vis(c.key)).map((c) => (
                <Td
                  key={c.key}
                  className={`whitespace-nowrap tabular-nums ${c.key === "b90837" ? "font-medium text-text" : "text-text-body"}`}
                >
                  {(m[RATE_FIELD[c.key]] as string | null) ?? "—"}
                </Td>
              ))}
            </Tr>
          ))}
        </Table>
      ) : (
        <Table
          className="min-h-0 flex-1"
          stickyHeader
          head={[
            "Insurer",
            "Network",
            "Code",
            <Tooltip key="rate" label="In-Network rate as published by the payer.">
              <span className="inline-flex cursor-help items-center gap-1">
                Rate <Icon name="info" size={13} className="text-text-muted" />
              </span>
            </Tooltip>,
            "Schedule",
            "Updated",
          ]}
        >
          {rates.map((r, i) => (
            <Tr key={`${r.payer}|${r.network}|${r.billingCode}|${r.figure}|${i}`}>
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
              <Td className="whitespace-nowrap" title={cptLabel(r.billingCode)}>
                {r.billingCode}
              </Td>
              <Td className="whitespace-nowrap font-medium text-text">{r.figure}</Td>
              <Td className="whitespace-nowrap">
                <Badge variant={r.basis === "Negotiated" ? "info" : "neutral"} className="!font-normal">
                  {r.basis}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap text-text-muted">{r.asOf ?? "—"}</Td>
            </Tr>
          ))}
        </Table>
      )}
    </>
  );
}

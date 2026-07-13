"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { LoadMoreRow, SortableHead, Table, Td, Tr, useLazyBatch, useSort } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { ChipMenu } from "@/components/rates/chip-menu";
import { cptLabel } from "@/components/rates/cpt";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import { titleCase } from "@/lib/format";
import type { NpiStanding } from "@/lib/repos/rate-signals";

// Screen: Panels — look up an NPI, get every payer book that lists it as a
// flat single-line-per-row table. Column model (settled with Brendan
// 2026-07-12): Insurer = the payer, the legal entity you bill (Oxford stays
// Oxford, wearing the UHC parent mark); Network = the product/network the
// rate is negotiated under (Optum/OHBS lives here, as text). Rate and As-of
// are separate columns; TIN, its clinician count, and the contract type
// (Solo / Group / Platform group) each get their own column.
//
// One input does both jobs: free text filters the loaded rows; a 10-digit
// NPI offers "Look up" (Enter or the button) and adds that clinician. They
// were separate fields at first — but a lookup is just a search the table
// can't answer yet, so one box scales better than two.

type Row = {
  npi: string;
  clinician: string;
  payer: string;
  network: string;
  billingCode: string;
  rate: string;
  basis: string;
  asOf: string;
  tin: string;
  onTin: number | null;
  nyBook: boolean;
  directoryListed: boolean;
  platform: boolean;
};

const nowrap = (label: string) => (
  <span key={label} className="whitespace-nowrap">
    {label}
  </span>
);
const HEAD_BASE = [
  "Insurer",
  "Network",
  "Code",
  nowrap("Rate In-Ntwk"),
  "Schedule",
  nowrap("As-of"),
  "TIN",
  nowrap("On TIN"),
  "Contract",
];
type SortCol = "clinician" | "payer" | "code" | "asOf" | "onTin";

// NPPES/MMIS individual names arrive "LAST Given…" — flip to reading order.
// When the given-name field holds multiple tokens, the goes-by name is the
// FINAL token, not the first (verified against a live record: "HILARIO HENRY
// JASON" is Jason Hilario — Henry is the middle name). Organizations
// (digits, corporate suffixes) pass through untouched.
const ORG_RE = /\d|\b(inc|llc|pllc|pc|corp|co|group|center|services|associates|company|hospital|clinic|health)\b/i;

function clinicianName(raw: string): string {
  const cased = titleCase(raw.trim());
  if (ORG_RE.test(raw)) return cased;
  const parts = cased.split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return cased;
  const [last, ...given] = parts;
  return `${given[given.length - 1]} ${last}`;
}

export function PanelsPanel() {
  const [q, setQ] = useState("");
  const [standings, setStandings] = useState<NpiStanding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insurer, setInsurer] = useState<string | undefined>();
  const [code, setCode] = useState<string | undefined>();
  const [sort, toggleSort] = useSort<SortCol>({ col: "payer", dir: "asc" });

  const npiCandidate = /^\d{10}$/.test(q.trim()) ? q.trim() : null;

  const lookup = async () => {
    if (!npiCandidate) return;
    if (standings.some((s) => s.npi === npiCandidate)) {
      setQ("");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rates/standing?npis=${npiCandidate}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed.");
      setStandings((prev) => [...data.standings, ...prev]);
      setQ("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const rows: Row[] = useMemo(
    () =>
      standings.flatMap((s) =>
        s.groups.flatMap((g) => {
          const ownBook = g.cohort?.byPayer.find((b) => b.payer === g.payer);
          return g.rates.map((r) => ({
            npi: s.npi,
            clinician: s.providerName ? clinicianName(s.providerName) : s.npi,
            payer: g.payer,
            network: g.planOrNetworks.join(" · "),
            billingCode: r.billingCode,
            rate: r.figure,
            basis: r.basis,
            asOf: r.asOf,
            tin: g.tin,
            onTin: ownBook?.clinicians ?? null,
            nyBook: g.nyBook,
            directoryListed: g.directoryListed,
            platform: g.cohort?.platformScale ?? false,
          }));
        }),
      ),
    [standings],
  );

  const noRowNpis = standings.filter((s) => s.groups.length === 0);
  const multi = standings.length > 1;
  const head = multi ? ["Clinician", ...HEAD_BASE] : HEAD_BASE;

  const insurerOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.payer))].sort().map((p) => ({
        value: p,
        label: p,
        lead: <InsurerMark payer={p} />,
      })),
    [rows],
  );
  const codeOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.billingCode))]
        .sort()
        .map((c) => ({ value: c, label: `${c} · ${cptLabel(c)}` })),
    [rows],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;
    return rows
      .filter(
        (r) =>
          (!needle ||
            `${r.clinician} ${r.payer} ${r.network} ${r.tin} ${r.billingCode}`.toLowerCase().includes(needle)) &&
          (!insurer || r.payer === insurer) &&
          (!code || r.billingCode === code),
      )
      .sort((a, b) => {
        const primary =
          sort.col === "clinician"
            ? a.clinician.localeCompare(b.clinician)
            : sort.col === "code"
              ? a.billingCode.localeCompare(b.billingCode)
              : sort.col === "asOf"
                ? a.asOf.localeCompare(b.asOf)
                : sort.col === "onTin"
                  ? (a.onTin ?? -1) - (b.onTin ?? -1)
                  : a.payer.localeCompare(b.payer);
        return primary * dir || a.payer.localeCompare(b.payer) || a.billingCode.localeCompare(b.billingCode);
      });
  }, [rows, q, insurer, code, sort]);

  const { visible, hasMore, sentinelRef } = useLazyBatch(shown, {
    resetKey: `${standings.map((s) => s.npi).join(",")}|${q}|${insurer}|${code}`,
  });

  const headCells: React.ReactNode[] = [
    ...(multi ? [<SortableHead key="clinician" label="Clinician" col="clinician" sort={sort} onSort={toggleSort} />] : []),
    <SortableHead key="payer" label="Insurer" col="payer" sort={sort} onSort={toggleSort} />,
    "Network",
    <SortableHead key="code" label="Code" col="code" sort={sort} onSort={toggleSort} />,
    nowrap("Rate In-Ntwk"),
    "Schedule",
    <SortableHead key="asOf" label="As-of" col="asOf" sort={sort} onSort={toggleSort} />,
    "TIN",
    <SortableHead key="onTin" label="On TIN" col="onTin" sort={sort} onSort={toggleSort} />,
    "Contract",
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3 md:mb-6">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="Search — or enter a 10-digit NPI to add a clinician"
          className="w-full max-w-md"
        />
        {npiCandidate && (
          <Button onClick={lookup} loading={loading}>
            Look up NPI
          </Button>
        )}
        <ChipMenu
          label="Insurer"
          options={insurerOptions}
          value={insurer}
          onSelect={setInsurer}
          onClear={() => setInsurer(undefined)}
        />
        <ChipMenu
          label="Code"
          options={codeOptions}
          value={code}
          onSelect={setCode}
          onClear={() => setCode(undefined)}
        />
        {standings.map((s) => (
          <Tag
            key={s.npi}
            hue="teal"
            onDismiss={() => setStandings((prev) => prev.filter((p) => p.npi !== s.npi))}
          >
            {s.providerName ? clinicianName(s.providerName) : s.npi}
          </Tag>
        ))}
      </div>
      {error && <Banner className="mb-4 shrink-0" variant="danger">{error}</Banner>}

      {noRowNpis.map((s) => (
        <Banner key={s.npi} className="mb-4 shrink-0" variant="info">
          {s.providerName ? clinicianName(s.providerName) : `NPI ${s.npi}`}: no published rate rows — which
          is <span className="font-semibold">not</span> the same as not being in-network. Some payers block
          rate-file pulls, and clinicians with out-of-state practice addresses are missing from NY files.
        </Banner>
      ))}

      {loading && rows.length === 0 ? (
        <TableSkeleton head={head} />
      ) : rows.length === 0 ? (
        !loading &&
        noRowNpis.length === 0 && (
          <EmptyState
            icon="activity"
            title="Know what payers actually pay — before you credential"
            subtext="Enter any NPI above to see every payer book that lists it, the network and TIN each contract rides under, and the payer's own published rates."
          />
        )
      ) : (
        <Table className="min-h-0 flex-1" stickyHeader head={headCells}>
          {shown.length === 0 && (
            <Tr>
              <Td colSpan={headCells.length} className="text-center text-text-muted">
                No rows match — clear the search or filters, or press Enter on a 10-digit NPI to add a
                clinician.
              </Td>
            </Tr>
          )}
          {visible.map((r, i) => (
            <Tr key={`${r.npi}|${r.payer}|${r.tin}|${r.billingCode}|${i}`}>
              {multi && <Td className="whitespace-nowrap">{r.clinician}</Td>}
              <Td className="whitespace-nowrap">
                <span className="flex items-center gap-2.5">
                  <InsurerMark payer={r.payer} />
                  <span className="max-w-48 truncate font-medium text-text" title={r.payer}>
                    {r.payer}
                  </span>
                </span>
              </Td>
              <Td>
                <span className="block max-w-44 truncate" title={r.network}>
                  {r.network}
                </span>
              </Td>
              <Td className="whitespace-nowrap" title={cptLabel(r.billingCode)}>
                {r.billingCode}
              </Td>
              <Td className="whitespace-nowrap font-medium text-text">{r.rate}</Td>
              <Td className="whitespace-nowrap">
                <Badge variant={r.basis === "Negotiated" ? "info" : "neutral"} className="!font-normal">
                  {r.basis}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap text-text-muted">{r.asOf}</Td>
              <Td className="whitespace-nowrap text-text-muted">{r.tin}</Td>
              <Td className="whitespace-nowrap">{r.onTin === null ? "—" : r.onTin.toLocaleString("en-US")}</Td>
              <Td className="whitespace-nowrap">
                <span className="flex items-center gap-1.5">
                  {r.platform ? (
                    <span title="A platform-scale group holds this contract on this TIN">
                      <Badge variant="warning" className="!font-normal">Platform</Badge>
                    </span>
                  ) : r.onTin === 1 ? (
                    <span title="One clinician on this TIN — their own contract">
                      <Badge variant="success" className="!font-normal">Solo</Badge>
                    </span>
                  ) : (
                    <span title="A practice group holds this contract on this TIN">
                      <Badge variant="info" className="!font-normal">Group</Badge>
                    </span>
                  )}
                  {!r.nyBook && <Badge variant="warning" className="!font-normal">Out-of-state</Badge>}
                  {r.directoryListed && <Badge variant="success" className="!font-normal">In directory</Badge>}
                </span>
              </Td>
            </Tr>
          ))}
          {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={headCells.length} />}
        </Table>
      )}
    </div>
  );
}

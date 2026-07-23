"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { ChipMenu } from "@/components/rates/chip-menu";
import { ALL_CPTS, cptLabel } from "@/components/rates/cpt";
import { InsurerCell, InsurerMark } from "@/components/rates/insurer-mark";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import { prettyNetworkLabel } from "@/lib/format";
import type { RateBand } from "@/lib/repos/rate-signals";

// Screen: the negotiation card. Per-payer × CPT × license-tier bands on
// deduped, NY-book, payer-published rows. License comes from the statewide
// directory profession join — real cohorts per tier, not a heuristic.
// Toolbar = the Clients/Directory pattern: search + "+ Code" / "+ Insurer" /
// "+ License" filter chips — all three are pure client-side filters over one
// unconditional fetch of every priced code, unchecked by default, table
// sorted Insurer A-Z out of the box. Nothing gates the initial view.
//
// On DataTable (2026-07-23, unified-table sweep): a band is an AGGREGATE — it
// has no drill-down page of its own, so the kebab links out to the insurer's
// published-rates view instead of "opening" the row.

const LICENSE_OPTIONS = [
  { value: "Masters-level", label: "Masters-level" },
  { value: "Psychologist", label: "Psychologist" },
  { value: "Prescriber (MD/NP)", label: "Prescriber (MD/NP)" },
];
const LICENSE_RANK: Record<string, number> = {
  "Masters-level": 0,
  Psychologist: 1,
  "Prescriber (MD/NP)": 2,
};

const SKELETON_HEAD = ["Service", "Code", "Insurer", "Network", "Clinicians", "License", "25% In-Ntwk", "Median In-Ntwk", "75% In-Ntwk", "Schedule", "As-of"];

export function BandsPanel({
  codes,
  onCodesChange,
  pin,
}: {
  codes: string[];
  onCodesChange: (codes: string[]) => void;
  /** Set by the Affiliation Economics "renegotiate" CTA — pins the insurer
   *  filter and makes sure the code is selected. */
  pin?: { payer: string; billingCode: string } | null;
}) {
  const router = useRouter();
  const [bands, setBands] = useState<RateBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [insurer, setInsurer] = useState<string | undefined>();
  const [license, setLicense] = useState<string | undefined>();

  useEffect(() => {
    if (!pin) return;
    setInsurer(pin.payer);
    if (!codes.includes(pin.billingCode)) onCodesChange([...codes, pin.billingCode]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // Always pulls every priced code — all twenty, not the five the chip used to
  // offer (NYS-50). The "Code" chip is a filter over this, not a fetch trigger,
  // so it never gates the table. Cost measured 2026-07-20: the sql/024 band
  // matview answers 20 codes in 1.4 ms vs 0.6 ms for 5 (468 -> 1,314 rows).
  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError(null);
    fetch(`/api/rates/bands?codes=${ALL_CPTS.map((c) => c.code).join(",")}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load bands.");
        if (!stale) setBands(data.bands);
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Couldn't load bands.");
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, []);

  const insurerOptions = useMemo(
    () =>
      [...new Set(bands.map((b) => b.payer))].sort().map((p) => ({
        value: p,
        label: p,
        lead: <InsurerMark payer={p} />,
      })),
    [bands],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return bands.filter(
      (b) =>
        (!needle || b.payer.toLowerCase().includes(needle)) &&
        (codes.length === 0 || codes.includes(b.billingCode)) &&
        (!insurer || b.payer === insurer) &&
        (!license || b.license === license),
    );
  }, [bands, q, codes, insurer, license]);

  const latestAsOf = bands.reduce<string | null>((m, b) => (b.asOf && (!m || b.asOf > m) ? b.asOf : m), null);

  const columns: DataTableColumn<RateBand>[] = [
    {
      key: "service",
      label: "Service",
      fixed: true,
      sortValue: (b) => b.billingCode,
      render: (b) => (
        <span className="block max-w-52 truncate" title={cptLabel(b.billingCode)}>
          {cptLabel(b.billingCode)}
        </span>
      ),
    },
    { key: "code", label: "Code", sortValue: (b) => b.billingCode, render: (b) => <span className="text-text-muted">{b.billingCode}</span> },
    { key: "payer", label: "Insurer", sortValue: (b) => b.payer, render: (b) => <InsurerCell payer={b.payer} /> },
    {
      key: "network",
      label: "Network",
      render: (b) => (
        <span className="block max-w-44 truncate" title={b.network}>
          {prettyNetworkLabel(b.network)}
        </span>
      ),
    },
    { key: "clinicians", label: "Clinicians", sortValue: (b) => b.clinicians, render: (b) => b.clinicians.toLocaleString("en-US") },
    {
      key: "license",
      label: "License",
      sortValue: (b) => LICENSE_RANK[b.license] ?? 9,
      render: (b) => <span title={b.license}>{b.license.replace(" (MD/NP)", "")}</span>,
    },
    { key: "p25", label: "25% In-Ntwk", align: "right", render: (b) => b.p25 },
    { key: "median", label: "Median In-Ntwk", align: "right", render: (b) => <span className="font-semibold text-text">{b.median}</span> },
    { key: "p75", label: "75% In-Ntwk", align: "right", render: (b) => b.p75 },
    {
      key: "schedule",
      label: "Schedule",
      render: (b) => (
        <Badge variant={b.negotiability === "flat" ? "neutral" : "info"} className="!font-normal">
          {b.negotiability === "flat" ? "Flat" : "Group"}
        </Badge>
      ),
    },
    { key: "asOf", label: "As-of", sortValue: (b) => b.asOf, render: (b) => <span className="text-text-muted">{b.asOf}</span> },
  ];

  if (error) return <Banner variant="danger">{error}</Banner>;
  if (loading) return <TableSkeleton head={SKELETON_HEAD} />;

  return (
    <DataTable
      columns={columns}
      rows={shown}
      rowKey={(b) => `${b.payer}|${b.network}|${b.billingCode}|${b.license}`}
      storageKey="rates.bands.columns"
      defaultSort={{ col: "payer", dir: "asc" }}
      lazy
      fillHeight
      className="min-h-0 flex-1"
      toolbarLeft={
        <>
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by insurer"
            className="w-full sm:w-[320px]"
          />
          <ChipMenu
            label="Code"
            options={ALL_CPTS.map((c) => ({ value: c.code, label: `${c.code} · ${c.label}` }))}
            values={codes}
            onToggle={(v) => onCodesChange(codes.includes(v) ? codes.filter((c) => c !== v) : [...codes, v])}
            onClear={() => onCodesChange([])}
          />
          <ChipMenu
            label="Insurer"
            options={insurerOptions}
            value={insurer}
            onSelect={setInsurer}
            onClear={() => setInsurer(undefined)}
          />
          <ChipMenu
            label="License"
            options={LICENSE_OPTIONS}
            value={license}
            onSelect={setLicense}
            onClear={() => setLicense(undefined)}
          />
        </>
      }
      rowActions={(b) => (
        <KebabMenu label={`Actions for ${b.payer} ${b.billingCode}`}>
          <MenuItem
            icon="dollar"
            label="Open insurer in Published rates"
            onClick={() => router.push(`/published-rates?payer=${encodeURIComponent(b.payer)}`)}
          />
        </KebabMenu>
      )}
      records={bands.length}
      updatedDate={latestAsOf}
      footnote={
        shown.length === 0 ? (
          <div className="rounded-card border border-border bg-surface shadow-card">
            <EmptyState
              icon="clipboard"
              title={bands.length === 0 ? "No published bands yet" : "No bands match these filters"}
              subtext="Bands are computed on deduped payer-published rows, NY-book entities only."
            />
          </div>
        ) : undefined
      }
    />
  );
}

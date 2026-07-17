"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { LoadMoreRow, SortableHead, Table, Td, Tr, useLazyBatch, useSort } from "@/components/ui/table";
import { ChipMenu } from "@/components/rates/chip-menu";
import { RATE_CPTS, cptLabel } from "@/components/rates/cpt";
import { InsurerCell, InsurerMark } from "@/components/rates/insurer-mark";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import type { RateBand } from "@/lib/repos/rate-signals";

// Screen: the negotiation card. Per-payer × CPT × license-tier bands on
// deduped, NY-book, payer-published rows. License comes from the statewide
// directory profession join — real cohorts per tier, not a heuristic.
// Toolbar = the Clients/Directory pattern: search + "+ Code" / "+ Insurer" /
// "+ License" filter chips — all three are pure client-side filters over one
// unconditional fetch of every RATE_CPTS code, unchecked by default, table
// sorted Insurer A-Z out of the box. Nothing gates the initial view.

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

const HEAD = ["Service", "Code", "Insurer", "Network", "Clinicians", "License", "25% In-Ntwk", "Median In-Ntwk", "75% In-Ntwk", "Schedule", "As-of"];
type SortCol = "payer" | "code" | "license" | "clinicians" | "asOf";

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
  const [bands, setBands] = useState<RateBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [insurer, setInsurer] = useState<string | undefined>();
  const [license, setLicense] = useState<string | undefined>();
  const [sort, toggleSort] = useSort<SortCol>({ col: "payer", dir: "asc" });

  useEffect(() => {
    if (!pin) return;
    setInsurer(pin.payer);
    if (!codes.includes(pin.billingCode)) onCodesChange([...codes, pin.billingCode]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // Always pulls every RATE_CPTS code (a small fixed list) — the "Code" chip
  // is a filter over this, not a fetch trigger, so it never gates the table.
  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError(null);
    fetch(`/api/rates/bands?codes=${RATE_CPTS.map((c) => c.code).join(",")}`)
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
    const dir = sort.dir === "asc" ? 1 : -1;
    return bands
      .filter(
        (b) =>
          (!needle || b.payer.toLowerCase().includes(needle)) &&
          (codes.length === 0 || codes.includes(b.billingCode)) &&
          (!insurer || b.payer === insurer) &&
          (!license || b.license === license),
      )
      .sort((a, b) => {
        const primary =
          sort.col === "code"
            ? a.billingCode.localeCompare(b.billingCode)
            : sort.col === "license"
              ? (LICENSE_RANK[a.license] ?? 9) - (LICENSE_RANK[b.license] ?? 9)
              : sort.col === "clinicians"
                ? a.clinicians - b.clinicians
                : sort.col === "asOf"
                  ? a.asOf.localeCompare(b.asOf)
                  : a.payer.localeCompare(b.payer);
        return (
          primary * dir ||
          a.payer.localeCompare(b.payer) ||
          a.billingCode.localeCompare(b.billingCode) ||
          (LICENSE_RANK[a.license] ?? 9) - (LICENSE_RANK[b.license] ?? 9)
        );
      });
  }, [bands, q, codes, insurer, license, sort]);

  const { visible, hasMore, sentinelRef } = useLazyBatch(shown, {
    resetKey: `${codes.join(",")}|${q}|${insurer}|${license}`,
  });

  const codeOptions = RATE_CPTS.map((c) => ({ value: c.code, label: `${c.code} · ${c.label}` }));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* The stacked layout: search full-width above the chrome, the facets
          inside it under the search (see DataTable's `stacked` variant — this
          panel hand-rolls the same anatomy because it drives the Table
          primitive directly rather than DataTable). */}
      <SearchInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by insurer"
        className="w-full shrink-0"
      />

      {error && <Banner className="shrink-0" variant="danger">{error}</Banner>}

      {loading ? (
        <TableSkeleton head={HEAD} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title={bands.length === 0 ? "No published bands yet" : "No bands match these filters"}
          subtext="Bands are computed on deduped payer-published rows, NY-book entities only."
        />
      ) : (
        <Table
          className="min-h-0 flex-1"
          stickyHeader
          tintedHeader
          toolbar={
            <>
              <ChipMenu
                label="Code"
                options={codeOptions}
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
              <span className="ml-auto text-sm tabular-nums text-text-muted">
                {shown.length.toLocaleString("en-US")} of {bands.length.toLocaleString("en-US")} bands
              </span>
            </>
          }
          head={[
            <SortableHead key="service" label="Service" col="code" sort={sort} onSort={toggleSort} />,
            <SortableHead key="code" label="Code" col="code" sort={sort} onSort={toggleSort} />,
            <SortableHead key="payer" label="Insurer" col="payer" sort={sort} onSort={toggleSort} />,
            "Network",
            <SortableHead key="clinicians" label="Clinicians" col="clinicians" sort={sort} onSort={toggleSort} />,
            <SortableHead key="license" label="License" col="license" sort={sort} onSort={toggleSort} />,
            "25% In-Ntwk",
            "Median In-Ntwk",
            "75% In-Ntwk",
            "Schedule",
            <SortableHead key="asOf" label="As-of" col="asOf" sort={sort} onSort={toggleSort} />,
          ]}
        >
          {visible.map((b) => (
            <Tr key={`${b.payer}|${b.network}|${b.billingCode}|${b.license}`}>
              <Td className="whitespace-nowrap">{cptLabel(b.billingCode)}</Td>
              <Td className="whitespace-nowrap text-text-muted">{b.billingCode}</Td>
              <Td>
                <InsurerCell payer={b.payer} />
              </Td>
              <Td>
                <span className="block max-w-44 truncate" title={b.network}>
                  {b.network}
                </span>
              </Td>
              <Td className="whitespace-nowrap">{b.clinicians.toLocaleString("en-US")}</Td>
              <Td className="whitespace-nowrap" title={b.license}>
                {b.license.replace(" (MD/NP)", "")}
              </Td>
              <Td className="whitespace-nowrap">{b.p25}</Td>
              <Td className="whitespace-nowrap font-semibold text-text">{b.median}</Td>
              <Td className="whitespace-nowrap">{b.p75}</Td>
              <Td className="whitespace-nowrap">
                <Badge variant={b.negotiability === "flat" ? "neutral" : "info"} className="!font-normal">
                  {b.negotiability === "flat" ? "Flat" : "Group"}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap text-text-muted">{b.asOf}</Td>
            </Tr>
          ))}
          {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={11} />}
        </Table>
      )}
    </div>
  );
}

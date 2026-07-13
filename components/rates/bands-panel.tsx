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
// "+ License" filter chips. Code selection fetches; the rest filter client-side.

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

const HEAD = ["Insurer", "Code", "Clinicians", "License", "25% In-Ntwk", "Median In-Ntwk", "75% In-Ntwk", "Schedule", "As-of"];
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

  useEffect(() => {
    if (codes.length === 0) {
      setBands([]);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    setError(null);
    fetch(`/api/rates/bands?codes=${codes.join(",")}`)
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
  }, [codes]);

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
  }, [bands, q, insurer, license, sort]);

  const { visible, hasMore, sentinelRef } = useLazyBatch(shown, {
    resetKey: `${codes.join(",")}|${q}|${insurer}|${license}`,
  });

  const codeOptions = RATE_CPTS.map((c) => ({ value: c.code, label: `${c.code} · ${c.label}` }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3 md:mb-6">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by insurer"
          className="w-full max-w-md"
        />
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
      </div>

      {error && <Banner className="mb-4 shrink-0" variant="danger">{error}</Banner>}

      {loading ? (
        <TableSkeleton head={HEAD} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title={codes.length === 0 ? "Pick at least one code" : "No published bands for this pick"}
          subtext="Bands are computed on deduped payer-published rows, NY-book entities only."
        />
      ) : (
        <Table
          className="min-h-0 flex-1"
          stickyHeader
          head={[
            <SortableHead key="payer" label="Insurer" col="payer" sort={sort} onSort={toggleSort} />,
            <SortableHead key="code" label="Code" col="code" sort={sort} onSort={toggleSort} />,
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
              <Td>
                {/* Network subline only when the payer's schedules differ by
                    network — "All networks" is the default assumption. */}
                <InsurerCell payer={b.payer} subline={b.network === "All networks" ? undefined : b.network} />
              </Td>
              <Td className="whitespace-nowrap" title={cptLabel(b.billingCode)}>
                {b.billingCode}
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
          {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={9} />}
        </Table>
      )}
    </div>
  );
}

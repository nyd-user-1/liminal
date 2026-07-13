"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Table, Td, Tr } from "@/components/ui/table";
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

const HEAD = ["Insurer", "Code", "License", "P25", "Median", "P75", "Schedule", "Clinicians", "As-of"];

export function BandsPanel({
  codes,
  onCodesChange,
}: {
  codes: string[];
  onCodesChange: (codes: string[]) => void;
}) {
  const [bands, setBands] = useState<RateBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [insurer, setInsurer] = useState<string | undefined>();
  const [license, setLicense] = useState<string | undefined>();

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
    return bands
      .filter(
        (b) =>
          (!needle || b.payer.toLowerCase().includes(needle)) &&
          (!insurer || b.payer === insurer) &&
          (!license || b.license === license),
      )
      .sort(
        (a, b) =>
          a.payer.localeCompare(b.payer) ||
          a.billingCode.localeCompare(b.billingCode) ||
          (LICENSE_RANK[a.license] ?? 9) - (LICENSE_RANK[b.license] ?? 9),
      );
  }, [bands, q, insurer, license]);

  const codeOptions = RATE_CPTS.map((c) => ({ value: c.code, label: `${c.code} · ${c.label}` }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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

      {error && <Banner variant="danger">{error}</Banner>}

      {loading ? (
        <TableSkeleton head={HEAD} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title={codes.length === 0 ? "Pick at least one code" : "No published bands for this pick"}
          subtext="Bands are computed on deduped payer-published rows, NY-book entities only."
        />
      ) : (
        <Table head={HEAD}>
          {shown.map((b) => (
            <Tr key={`${b.payer}|${b.billingCode}|${b.license}`}>
              <Td>
                <InsurerCell payer={b.payer} />
              </Td>
              <Td className="whitespace-nowrap" title={cptLabel(b.billingCode)}>
                {b.billingCode}
              </Td>
              <Td className="whitespace-nowrap" title={b.license}>
                {b.license.replace(" (MD/NP)", "")}
              </Td>
              <Td className="whitespace-nowrap">{b.p25}</Td>
              <Td className="whitespace-nowrap font-semibold text-text">{b.median}</Td>
              <Td className="whitespace-nowrap">{b.p75}</Td>
              <Td className="whitespace-nowrap">
                <Badge variant={b.negotiability === "flat" ? "neutral" : "info"}>
                  {b.negotiability === "flat" ? "Flat schedule" : "Per group"}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap">{b.clinicians.toLocaleString("en-US")}</Td>
              <Td className="whitespace-nowrap text-text-muted">{b.asOf}</Td>
            </Tr>
          ))}
        </Table>
      )}
    </div>
  );
}

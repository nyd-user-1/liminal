"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { FilterChip } from "@/components/ui/filter-chip";
import { Icon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
// From lib/rate-table (no db import), never lib/repos — a VALUE import from a
// repo pulls lib/db into this bundle and the Neon proxy throws in the browser.
import {
  maskTin,
  RATE_CODES,
  RATE_TABLE_PAYERS,
  type RateTableData,
  type RateTableRow,
} from "@/lib/rate-table";

// The table IS the argument: no charts, no percentile, no benchmark score. A
// percentile is a claim someone can dispute; a table of literal published rates
// is a fact. Keep it that way — see docs/TASK-PUBLIC-RATE-TABLE.md.

/** -1 sinks blank cells on a descending sort (the num() pattern from insurers-board). */
const num = (n: number | null) => n ?? -1;
const money = (n: number | null) =>
  n === null ? <span className="text-text-muted">—</span> : `$${n.toFixed(2)}`;

/** Sinks NULLs to the bottom of an ascending text sort. */
const text = (s: string | null) => s ?? "￿";

/** Case- and diacritic-insensitive. */
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** "2026-07-01" → "Jul 1, 2026". Parsed at LOCAL midnight on purpose: formatDate's
 *  bare `new Date("2026-07-01")` is UTC midnight, which renders as the day before
 *  west of Greenwich — and this date is the whole point of the footer. */
const formatAsOf = (iso: string) => formatDate(`${iso}T00:00:00`);

// FilterChip + attached popover, multi-select — the /directory ChipMenu pattern
// with checks instead of single-select, since the whole point is comparing many
// licenses at once. h-10 to match every other control in the toolbar.
function CredentialChip({
  facets,
  selected,
  onToggle,
  onClear,
}: {
  facets: Array<[cred: string, count: number]>;
  selected: Set<string>;
  onToggle: (cred: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const shown = term ? facets.filter(([c]) => c.toLowerCase().includes(term.toLowerCase())) : facets;
  const list = [...selected];
  const value = list.length === 0 ? undefined : list.length === 1 ? list[0] : `${list[0]} +${list.length - 1}`;

  return (
    <span ref={ref} className="relative">
      <FilterChip label="Credential" value={value} onClick={() => setOpen((o) => !o)} onClear={onClear} className="h-10" />
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-72 rounded-card border border-border bg-surface p-2 shadow-menu">
          <SearchInput
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Filter credentials…"
            className="mb-1.5 w-full"
          />
          <div className="max-h-72 overflow-y-auto">
            {shown.map(([cred, count]) => {
              const on = selected.has(cred);
              return (
                <button
                  key={cred}
                  type="button"
                  onClick={() => onToggle(cred)}
                  className={`flex w-full items-center gap-2 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                    on ? "font-semibold text-primary" : "text-text"
                  }`}
                >
                  <span className="flex-1 truncate">{cred}</span>
                  <span className="shrink-0 text-[13px] text-text-muted">{count.toLocaleString("en-US")}</span>
                  <Icon name="check" size={16} className={`shrink-0 text-primary ${on ? "" : "opacity-0"}`} />
                </button>
              );
            })}
            {shown.length === 0 && <p className="px-2.5 py-2 text-sm text-text-muted">No matches</p>}
          </div>
        </div>
      )}
    </span>
  );
}

export function PublishedRatesClient({ data }: { data: RateTableData }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  const facets = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.rows) if (r.credentialNorm) m.set(r.credentialNorm, (m.get(r.credentialNorm) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [data.rows]);

  // Credential is the only control that filters. Rows without a credential are
  // organizations (a group's clinicians have many licenses) — dropping them when
  // a license is selected is the expected, correct behaviour.
  const rows = useMemo(
    () => (selected.size === 0 ? data.rows : data.rows.filter((r) => r.credentialNorm && selected.has(r.credentialNorm))),
    [data.rows, selected],
  );

  // Search does NOT filter — it finds. The surrounding rows are the entire point,
  // so we resolve a best match and let the table jump to it in place.
  const scrollToKey = useMemo(() => {
    const q = norm(debounced.trim());
    if (!q) return null;
    const digits = q.replace(/\D/g, "");
    let best: { score: number; key: string } | null = null;
    for (const r of rows) {
      let score = -1;
      if (digits.length >= 4) {
        if (r.npis.includes(digits)) score = 100;
        else if (r.tin.replace(/\D/g, "").includes(digits)) score = 90;
      }
      if (score < 0 && r.displayName) {
        const n = norm(r.displayName);
        if (n.startsWith(q)) score = 80;
        else if (n.includes(q)) score = 60;
      }
      if (score >= 0 && (!best || score > best.score)) best = { score, key: r.tin };
      if (best?.score === 100) break;
    }
    return best?.key ?? null;
  }, [debounced, rows]);

  const columns: DataTableColumn<RateTableRow>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Practice / Clinician",
        fixed: true,
        // Bounded so the five rate columns — the actual argument — fit without
        // the table scrolling on a laptop. Long names truncate with a title.
        cellClassName: "max-w-[24rem]",
        sortValue: (r) => text(r.displayName),
        render: (r) => (
          <span className="flex min-w-0 items-center gap-2">
            {r.displayName ? (
              <span className="truncate" title={r.displayName}>
                {r.displayName}
              </span>
            ) : (
              // Still findable by TIN or NPI — the search covers both.
              <span className="truncate text-text-muted">
                Unnamed practice · {r.nClinicians.toLocaleString("en-US")} clinician{r.nClinicians === 1 ? "" : "s"}
              </span>
            )}
            {r.entityKind === "organization" && <Badge className="shrink-0">org</Badge>}
            <span className="shrink-0 text-[13px] text-text-muted">{maskTin(r.tin)}</span>
          </span>
        ),
      },
      {
        key: "credential",
        label: "Credential",
        sortValue: (r) => text(r.credential),
        render: (r) => r.credential ?? <span className="text-text-muted">—</span>,
      },
      {
        key: "county",
        label: "County",
        sortValue: (r) => text(r.county),
        render: (r) => r.county ?? <span className="text-text-muted">—</span>,
      },
      ...RATE_CODES.map((c) => ({
        key: c.key,
        label: c.code,
        // One-row headers: the plain-English name rides along as a tooltip and
        // repeats in the legend above the table.
        headTitle: c.name,
        align: "right" as const,
        sortValue: (r: RateTableRow) => num(r[c.key]),
        render: (r: RateTableRow) => money(r[c.key]),
      })),
    ],
    [],
  );

  return (
    // min-w-0 is load-bearing: without it this flex column grows past the shell
    // and the PAGE scrolls sideways instead of the Table's own overflow wrapper.
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-[13px] text-text-muted">
        {RATE_CODES.map((c) => `${c.code} ${c.name}`).join(" · ")}
      </p>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.tin}
        storageKey="published-rates.columns"
        defaultSort={{ col: "c90837", dir: "desc" }}
        lazy
        scrollToKey={scrollToKey}
        toolbarExtra={
          <>
            <Select
              options={RATE_TABLE_PAYERS.map((p) => ({ value: p, label: p }))}
              value={data.payer}
              onValueChange={(v) => router.push(`/published-rates?payer=${encodeURIComponent(v)}`)}
              aria-label="Insurer"
              className="w-64"
            />
            <CredentialChip
              facets={facets}
              selected={selected}
              onToggle={(cred) =>
                setSelected((s) => {
                  const next = new Set(s);
                  if (next.has(cred)) next.delete(cred);
                  else next.add(cred);
                  return next;
                })
              }
              onClear={() => setSelected(new Set())}
            />
            <SearchInput
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Find a practice, TIN or NPI"
              className="w-72"
            />
          </>
        }
        footnote={
          <p className="text-[13px] leading-relaxed text-text-muted">
            Source: Transparency in Coverage machine-readable files published by {data.payer}.{" "}
            {data.asOf ? `Rates as of ${formatAsOf(data.asOf)}.` : null} A rate is what the insurer publishes it pays the
            billing entity for an in-network professional service — it is not what a patient pays.
          </p>
        }
      />
    </div>
  );
}

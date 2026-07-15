"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { InsurerCell, InsurerMark } from "@/components/rates/insurer-mark";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { FilterChip } from "@/components/ui/filter-chip";
import { Icon } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { formatDate, providerDisplayName } from "@/lib/format";
// From lib/rate-table (no db import), never lib/repos — a VALUE import from a
// repo pulls lib/db into this bundle and the Neon proxy throws in the browser.
import {
  rateRowKey,
  RATE_CODES,
  RATE_TABLE_PAYERS,
  rowNpi,
  tinKind,
  tinValue,
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
const dash = <span className="text-text-muted">—</span>;

/** Sinks NULLs to the bottom of an ascending text sort. */
const text = (s: string | null) => s ?? "￿";

/** Case- and diacritic-insensitive. */
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** "2026-07-01" → "Jul 1, 2026". Parsed at LOCAL midnight on purpose: formatDate's
 *  bare `new Date("2026-07-01")` is UTC midnight, which renders as the day before
 *  west of Greenwich — and this date is the whole point of the footer. */
const formatAsOf = (iso: string) => formatDate(`${iso}T00:00:00`);

/**
 * tin_registry stores people as NPPES writes them — "PADGETT MARISA
 * (individual)". The suffix duplicates the Type column and the order is
 * surname-first, so people render through providerDisplayName ("Marisa
 * Padgett"), the same helper /directory uses. Organizations keep their legal
 * name verbatim: title-casing it would mangle "LCSW, PLLC" into "Lcsw, Pllc".
 */
const INDIVIDUAL_SUFFIX = / \(individual\)$/i;
function rowName(r: RateTableRow): string {
  if (!r.displayName) return `Unnamed practice ${r.unnamedNo ?? "?"}`;
  if (r.entityKind === "individual") return providerDisplayName(r.displayName.replace(INDIVIDUAL_SUFFIX, ""), "1");
  return r.displayName;
}

type TabKey = "all" | "organization" | "individual";
const TABS = [
  { key: "all", label: "All" },
  { key: "organization", label: "Practices" },
  { key: "individual", label: "Providers" },
] as const;

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  lead?: ReactNode;
}

/**
 * FilterChip + attached multi-select popover — the /directory ChipMenu shape.
 * This is a FILTER, not a tag: it narrows to values already on the rows and
 * never writes anything to them. Insurer and Credential both use it, so the two
 * controls behave identically.
 */
function FacetChip({
  label,
  options,
  selected,
  onToggle,
  onClear,
  searchable = true,
}: {
  label: string;
  options: FacetOption[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear: () => void;
  searchable?: boolean;
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

  const shown = term ? options.filter((o) => o.label.toLowerCase().includes(term.toLowerCase())) : options;
  const list = options.filter((o) => selected.has(o.value));
  const value = list.length === 0 ? undefined : list.length === 1 ? list[0].label : `${list[0].label} +${list.length - 1}`;

  return (
    <span ref={ref} className="relative">
      <FilterChip label={label} value={value} onClick={() => setOpen((o) => !o)} onClear={onClear} />
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-80 rounded-card border border-border bg-surface p-2 shadow-menu">
          {searchable && (
            <SearchInput
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}…`}
              className="mb-1.5 w-full"
            />
          )}
          <div className="max-h-72 overflow-y-auto">
            {shown.map((o) => {
              const on = selected.has(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onToggle(o.value)}
                  className={`flex w-full items-center gap-2 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                    on ? "font-semibold text-primary" : "text-text"
                  }`}
                >
                  {o.lead}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  <span className="shrink-0 text-[13px] text-text-muted">{o.count.toLocaleString("en-US")}</span>
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
  const [tab, setTab] = useState<TabKey>("all");
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [creds, setCreds] = useState<Set<string>>(new Set());
  const [payers, setPayers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  const credFacets = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.rows) if (r.credentialNorm) m.set(r.credentialNorm, (m.get(r.credentialNorm) ?? 0) + 1);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [data.rows]);

  const payerFacets = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.rows) m.set(r.payer, (m.get(r.payer) ?? 0) + 1);
    return RATE_TABLE_PAYERS.filter((p) => m.has(p)).map((p) => ({
      value: p,
      label: p,
      count: m.get(p)!,
      lead: <InsurerMark payer={p} />,
    }));
  }, [data.rows]);

  const counts = useMemo(() => {
    let organization = 0;
    for (const r of data.rows) if (r.entityKind === "organization") organization++;
    return { all: data.rows.length, organization, individual: data.rows.length - organization };
  }, [data.rows]);

  // Tab + the two facet filters. Search deliberately does NOT filter (below).
  // Filtering by credential drops organizations by construction — a group's
  // providers hold many licenses, so org rows carry no single credential.
  const rows = useMemo(() => {
    let out = data.rows;
    if (tab !== "all") out = out.filter((r) => r.entityKind === tab);
    if (payers.size) out = out.filter((r) => payers.has(r.payer));
    if (creds.size) out = out.filter((r) => r.credentialNorm && creds.has(r.credentialNorm));
    return out;
  }, [data.rows, tab, payers, creds]);

  // Search finds, it doesn't filter — the surrounding rows are the entire point,
  // so we resolve a best match and let the table jump to it in place. Matches
  // name (case/diacritic-insensitive), TIN, or any roster NPI.
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
      if (score < 0) {
        const n = norm(rowName(r));
        if (n.startsWith(q)) score = 80;
        else if (n.includes(q)) score = 60;
      }
      if (score >= 0 && (!best || score > best.score)) best = { score, key: rateRowKey(r) };
      if (best?.score === 100) break;
    }
    return best?.key ?? null;
  }, [debounced, rows]);

  const columns: DataTableColumn<RateTableRow>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Practice / Provider",
        fixed: true,
        cellClassName: "max-w-[20rem]",
        sortValue: (r) => rowName(r),
        render: (r) => {
          const name = rowName(r);
          return (
            // `primary` + !block, not the default wipe: wipe wraps the label in a
            // flex item of an inline-flex anchor, and text-overflow never applies
            // to a flex item — a bare `truncate` on the link hard-clips mid-word.
            <TextLink
              href={`/orgs/${encodeURIComponent(r.tin)}`}
              variant="primary"
              className="!block min-w-0 truncate"
              title={name}
            >
              {name}
            </TextLink>
          );
        },
      },
      {
        key: "type",
        label: "Type",
        sortValue: (r) => r.entityKind,
        render: (r) => <Badge>{r.entityKind === "organization" ? "Org" : "Individual"}</Badge>,
      },
      {
        key: "payer",
        label: "Insurer",
        cellClassName: "max-w-[16rem]",
        sortValue: (r) => r.payer,
        render: (r) => <InsurerCell payer={r.payer} />,
      },
      {
        key: "tin",
        // A TIN is EITHER an EIN or an NPI — never both. One column, typed.
        label: "TIN",
        sortValue: (r) => r.tin,
        render: (r) => (
          <span className="tabular-nums">
            <span className="mr-1.5 text-[13px] text-text-muted">{tinKind(r.tin)}</span>
            {tinValue(r.tin)}
          </span>
        ),
      },
      {
        key: "npi",
        label: "NPI",
        sortValue: (r) => text(rowNpi(r)),
        render: (r) => {
          const npi = rowNpi(r);
          // A group bills many NPIs — no single answer, so no invented one.
          return npi ? <span className="tabular-nums text-text-muted">{npi}</span> : dash;
        },
      },
      ...RATE_CODES.map((c) => ({
        key: c.key,
        label: c.code,
        // One-row headers: the plain-English name rides along as a tooltip.
        headTitle: c.name,
        align: "right" as const,
        sortValue: (r: RateTableRow) => num(r[c.key]),
        render: (r: RateTableRow) => money(r[c.key]),
      })),
      {
        key: "actions",
        label: "",
        fixed: true,
        align: "right",
        render: (r) => (
          <KebabMenu label={`Actions for ${rowName(r)}`}>
            <MenuItem
              icon="id-card"
              label="View organization"
              onClick={() => router.push(`/orgs/${encodeURIComponent(r.tin)}`)}
            />
            <MenuItem
              icon="activity"
              label="Open in Rates"
              onClick={() => router.push(`/rates?tin=${encodeURIComponent(r.tin)}`)}
            />
          </KebabMenu>
        ),
      },
    ],
    [router],
  );

  // One date per insurer, never one for the table: the books are months apart
  // (Cigna 2026-07-01 vs MetroPlus 2024-02-07) and a folded date would render
  // MetroPlus's two-year-old book as current.
  const dates = RATE_TABLE_PAYERS.filter((p) => data.asOfByPayer[p]).map(
    (p) => `${p} ${formatAsOf(data.asOfByPayer[p]!)}`,
  );

  const toggler = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (v: string) =>
    set((s) => {
      const next = new Set(s);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  return (
    // h-full (not flex-1) because the shell's <main> is a block, not a flex
    // container — same bridge /directory uses. With min-h-0 it bounds the table
    // so its ROWS scroll under a sticky header instead of the page growing;
    // min-w-0 keeps the horizontal scroll inside the table's own container.
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <Tabs
        className="mb-4 shrink-0"
        slideActive
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        items={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] }))}
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={rateRowKey}
        storageKey="published-rates.columns"
        defaultSort={{ col: "c90837", dir: "desc" }}
        lazy
        fillHeight
        scrollToKey={scrollToKey}
        toolbarLeft={
          <>
            <SearchInput
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Find by name, TIN or NPI"
              className="max-w-md flex-1"
            />
            <FacetChip
              label="Insurer"
              options={payerFacets}
              selected={payers}
              onToggle={toggler(setPayers)}
              onClear={() => setPayers(new Set())}
              searchable={false}
            />
            <FacetChip
              label="Credential"
              options={credFacets}
              selected={creds}
              onToggle={toggler(setCreds)}
              onClear={() => setCreds(new Set())}
            />
          </>
        }
        footnote={
          <p className="shrink-0 text-[13px] leading-relaxed text-text-muted">
            Source: Transparency in Coverage machine-readable files published by each insurer shown. Rates as of{" "}
            {dates.join(" · ")}. A rate is what the insurer publishes it pays the billing entity for an in-network
            professional service — it is not what a patient pays.
          </p>
        }
      />
    </div>
  );
}

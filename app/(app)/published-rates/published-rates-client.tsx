"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InsurerCell, insurerLogo } from "@/components/rates/insurer-mark";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { FilterChip } from "@/components/ui/filter-chip";
import { Icon } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { formatDate } from "@/lib/format";
// From lib/rate-table (no db import), never lib/repos — a VALUE import from a
// repo pulls lib/db into this bundle and the Neon proxy throws in the browser.
import {
  ALL_PAYERS,
  maskTin,
  rateRowKey,
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

type TabKey = "all" | "organization" | "individual";
const TABS = [
  { key: "all", label: "All" },
  { key: "organization", label: "Practices" },
  { key: "individual", label: "Clinicians" },
] as const;

// FilterChip + attached popover, multi-select — the /directory ChipMenu pattern
// with checks instead of single-select, since the whole point is comparing many
// licenses at once.
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
      <FilterChip label="Credential" value={value} onClick={() => setOpen((o) => !o)} onClear={onClear} />
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-72 rounded-card border border-border bg-surface p-2 shadow-menu">
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
  const [tab, setTab] = useState<TabKey>("all");
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

  const counts = useMemo(() => {
    let organization = 0;
    for (const r of data.rows) if (r.entityKind === "organization") organization++;
    return { all: data.rows.length, organization, individual: data.rows.length - organization };
  }, [data.rows]);

  // Tab + credential filter. Search deliberately does NOT filter (below).
  // Filtering by credential drops organizations by construction — a group's
  // clinicians hold many licenses, so org rows carry no single credential.
  const rows = useMemo(() => {
    let out = data.rows;
    if (tab !== "all") out = out.filter((r) => r.entityKind === tab);
    if (selected.size) out = out.filter((r) => r.credentialNorm && selected.has(r.credentialNorm));
    return out;
  }, [data.rows, tab, selected]);

  // Search finds, it doesn't filter — the surrounding rows are the entire point,
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
      if (score >= 0 && (!best || score > best.score)) best = { score, key: rateRowKey(r) };
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
        cellClassName: "max-w-[22rem]",
        sortValue: (r) => text(r.displayName),
        render: (r) => {
          const name =
            r.displayName ??
            `Unnamed practice · ${r.nClinicians.toLocaleString("en-US")} clinician${r.nClinicians === 1 ? "" : "s"}`;
          return (
            <span className="flex min-w-0 items-center gap-2">
              {/* Every row is a billing TIN, so every row has an org page.
                  `primary` + !block, not the default wipe: wipe wraps the label
                  in a flex item of an inline-flex anchor, and text-overflow
                  never applies to a flex item — so the /directory spelling
                  (`truncate` on the link) hard-clips mid-word here. Forcing the
                  anchor to a block box gives the ellipsis a box to work in.
                  /directory just never has names long enough to show it. */}
              <TextLink
                href={`/orgs/${encodeURIComponent(r.tin)}`}
                variant="primary"
                className="!block min-w-0 truncate"
                title={name}
              >
                {name}
              </TextLink>
              {r.entityKind === "organization" && <Badge className="shrink-0">org</Badge>}
              <span className="shrink-0 text-[13px] text-text-muted">{maskTin(r.tin)}</span>
            </span>
          );
        },
      },
      {
        key: "payer",
        label: "Insurer",
        cellClassName: "max-w-[18rem]",
        sortValue: (r) => r.payer,
        render: (r) => <InsurerCell payer={r.payer} />,
      },
      {
        key: "credential",
        label: "Credential",
        sortValue: (r) => text(r.credential),
        render: (r) => r.credential ?? <span className="text-text-muted">—</span>,
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
          <KebabMenu label={`Actions for ${r.displayName ?? r.tin}`}>
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
              placeholder="Find a practice, TIN or NPI"
              className="max-w-md flex-1"
            />
            <Select
              options={[
                { value: ALL_PAYERS, label: "All insurers", iconName: "id-card" },
                ...RATE_TABLE_PAYERS.map((p) => ({ value: p, label: p, image: insurerLogo(p) })),
              ]}
              value={data.selection}
              onValueChange={(v) => router.push(v === ALL_PAYERS ? "/published-rates" : `/published-rates?payer=${encodeURIComponent(v)}`)}
              aria-label="Insurer"
              className="w-56"
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

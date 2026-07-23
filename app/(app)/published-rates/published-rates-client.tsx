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
import { RelatedLink, TextLink } from "@/components/ui/text-link";
import { normalizeOrgName, prettyNetworkLabel, providerDisplayName, titleCase } from "@/lib/format";
// From lib/rate-table (no db import), never lib/repos — a VALUE import from a
// repo pulls lib/db into this bundle and the Neon proxy throws in the browser.
import {
  billingIdKind,
  billingIdValue,
  isGroupHeader,
  networkLabel,
  rateCell,
  rateRowKey,
  settingLabel,
  RATE_CODES,
  RATE_TABLE_PAYERS,
  rowNpi,
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

/**
 * tin_registry stores people as NPPES writes them — "PADGETT MARISA
 * (individual)". The suffix duplicates the Type column and the order is
 * surname-first, so people render through providerDisplayName ("Marisa
 * Padgett"), the same helper /directory uses. Organizations keep their legal
 * name verbatim: title-casing it would mangle "LCSW, PLLC" into "Lcsw, Pllc".
 *
 * The suffix — NOT entityKind — decides which of those two happens, because
 * they answer different questions. The suffix says where the NAME came from (a
 * person's NPPES record); entityKind says who the PAYER CONTRACTS WITH. Those
 * used to coincide and no longer do: since entity_kind started reading NPPES
 * `sole_proprietor` (sql/027), 9,243 rows are an organization — the clinician
 * is employed or incorporated, so the EIN is not theirs — while the only name
 * we can put to that EIN is still the one clinician we can see billing under
 * it. Keying off entityKind rendered those as "LAVIGNE TIMOTHY WILLIAM
 * (individual)" beside an "Org" chip: raw suffix, surname-first, contradicting
 * the chip next to it. A person's name is formatted like a person's name
 * whoever the payer is contracting with.
 */
const INDIVIDUAL_SUFFIX = / \(individual\)$/i;
function rowName(r: RateTableRow): string {
  // A child is always a person — directory_providers writes them the way NPPES
  // does, "BECKER JESSICA", so they format like every other person in the app.
  // No name is survivable here in a way it never is for a group: the NPI still
  // identifies them, and identifying them is the entire reason the row exists.
  if (r.isChild) {
    return r.displayName ? providerDisplayName(r.displayName, "1") : `NPI ${r.npis[0] ?? "—"}`;
  }
  if (!r.displayName) return `Unnamed practice ${r.unnamedNo ?? "?"}`;
  if (INDIVIDUAL_SUFFIX.test(r.displayName))
    return providerDisplayName(r.displayName.replace(INDIVIDUAL_SUFFIX, ""), "1");
  // Orgs keep their legal name but drop the SHOUTING — suffixes ("LCSW, PLLC")
  // stay uppercase via the normalizer's keep-list.
  return normalizeOrgName(r.displayName);
}

/**
 * Tab labels track the Type chips ("Org" / "Individual") on the rows they
 * filter. They used to read "Practices" and "Providers", which described the
 * same two sets in a different vocabulary — and "Providers" was wrong twice
 * over: an organization is also a provider, so the word does not name the
 * distinction the tab draws. The split is who the payer contracts with — an
 * organization, or one person — so the tabs say that.
 */
type TabKey = "all" | "organization" | "individual";
const TABS = [
  { key: "all", label: "All" },
  { key: "organization", label: "Organizations" },
  { key: "individual", label: "Individuals" },
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

export function PublishedRatesClient({
  data,
  initialPayer,
  initialQ,
}: {
  data: RateTableData;
  /** Deep-link seeds (from the /orgs Map tab) — the page stays client-filtered. */
  initialPayer?: string;
  initialQ?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");
  const [term, setTerm] = useState(initialQ ?? "");
  const [debounced, setDebounced] = useState(initialQ ?? "");
  const [creds, setCreds] = useState<Set<string>>(new Set());
  const [payers, setPayers] = useState<Set<string>>(() => (initialPayer ? new Set([initialPayer]) : new Set()));

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
          // A clinician inside a group: their name is the identity, and the
          // discipline + city beside it are how they recognize themselves. No
          // link — the group above already links to /orgs, and a child row's job
          // is to be read, not navigated.
          if (r.isChild) {
            const meta = [r.profession, r.city && titleCase(r.city)].filter(Boolean).join(" · ");
            return (
              <span className="block min-w-0 truncate" title={`${name}${meta ? ` · ${meta}` : ""}`}>
                {name}
                {meta && <span className="ml-1.5 text-[13px] text-text-muted">{meta}</span>}
              </span>
            );
          }
          return (
            // `primary` + !block, not the default wipe: wipe wraps the label in a
            // flex item of an inline-flex anchor, and text-overflow never applies
            // to a flex item — a bare `truncate` on the link hard-clips mid-word.
            <TextLink
              href={`/orgs/${encodeURIComponent(r.tin)}`}
              variant="name"
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
        // NOT "TIN": the value is whichever identifier the insurer published for
        // this billing group, and an NPI is not a tax ID. The type prefix says
        // which kind it is — that's the insurer's choice, not the provider's.
        label: "Billing ID",
        headTitle: "The identifier the insurer publishes for this billing group — an EIN, or an NPI standing in for one",
        sortValue: (r) => r.tin,
        // The identifier IS a record in the org book — dotted, because it
        // crosses tables rather than drilling into this row.
        render: (r) => (
          <span className="tabular-nums">
            <span className="mr-1.5 text-[13px] text-text-muted">{billingIdKind(r.tin)}</span>
            <RelatedLink href={`/orgs/${encodeURIComponent(r.tin)}`} title={`Open this billing group in the org book`}>
              {billingIdValue(r.tin)}
            </RelatedLink>
          </span>
        ),
      },
      {
        key: "npi",
        label: "NPI",
        headTitle: "The provider billing under this group. Blank when the group has more than one.",
        sortValue: (r) => text(rowNpi(r)),
        render: (r) => {
          const npi = rowNpi(r);
          // The member's NPI, never the identifier — a group bills many NPIs, so
          // there is no single answer and we don't invent one.
          return npi ? <span className="tabular-nums text-text-muted">{npi}</span> : dash;
        },
      },
      {
        key: "network",
        label: "Network",
        headTitle: "The insurer's plan/network this rate belongs to. Blank on a group header.",
        cellClassName: "max-w-[13rem] truncate",
        sortValue: (r: RateTableRow) => text(r.network ?? null),
        render: (r: RateTableRow) => {
          const n = networkLabel(r.network, r.payer);
          return n ? (
            <span className="text-text-muted" title={r.network ?? undefined}>{prettyNetworkLabel(n)}</span>
          ) : null;
        },
      },
      {
        key: "setting",
        label: "Setting",
        // Not cosmetic: this column is the reason a row exists twice. Cigna pays
        // Georgianna Dart $137.47 for 90791 in an office and $133.02 in a
        // facility — two published rows, one price each. Collapsing them is what
        // produced "3 rates" in a dollar column.
        headTitle: "Where the service is delivered. The payer prices office and facility separately.",
        sortValue: (r: RateTableRow) => settingLabel(r.setting),
        render: (r: RateTableRow) => {
          const l = settingLabel(r.setting);
          return l ? (
            <span className="text-text-muted" title={r.setting ?? undefined}>{l}</span>
          ) : null;
        },
      },
      ...RATE_CODES.map((c, i) => ({
        key: c.key,
        label: c.code,
        // One-row headers: the plain-English name rides along as a tooltip.
        headTitle: c.name,
        align: "right" as const,
        sortValue: (r: RateTableRow) => num(r[c.key]),
        render: (r: RateTableRow) => {
          // A group header summarizes nothing. It is a LABEL: the billing ID,
          // its chevron, and nothing else. Every rate column therefore holds one
          // unit — dollars — from top to bottom.
          //
          // This column used to render a count here ("4 rates") beside "$155.00"
          // one row down: a cardinality and a price sharing a column. That is
          // what made "4 rates" over three clinician rows unreadable — the number
          // counted distinct PRICES, not rows, and no wording fixes a column with
          // two units in it. The children carry the numbers.
          if (isGroupHeader(r)) return null;
          const { rate, n } = rateCell(r, i);
          if (n === 1) return money(rate);
          if (n === 0) return dash;
          // Nothing left to split on: this is ONE published row (one NPI, one
          // network, one setting) that still carries several rates, because the
          // column that separates them — billing_code_modifier — is dropped at
          // ingest (NYS-64). 9% of leaves. The count is the only true thing we
          // can say, and there is no deeper row to open.
          return (
            <span
              className="text-text-muted"
              title={`${r.payer} publishes ${n} rates for this provider on this network and setting, and the file gives us nothing that separates them (NYS-64)`}
            >
              {n} rates
            </span>
          );
        },
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
        subRows={(r) => r.children}
        isSubRow={(r) => !!r.isChild}
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
        // The standard footer, minus a folded "Updated" date on purpose: the
        // books are months apart (Cigna 2026-07-01 vs MetroPlus 2024-02-07) and
        // one date would render MetroPlus's two-year-old book as current. The
        // per-insurer dates live on the As-of column; the header tooltip on
        // Rate cells carries the not-what-a-patient-pays framing.
        records={data.rows.length}
      />
    </div>
  );
}

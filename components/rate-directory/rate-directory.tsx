"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { shortProfession } from "@/lib/format";
import type { RatedProvider } from "@/lib/repos/rate-directory";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { IndexHeader } from "@/components/ui/index-header";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { useToast } from "@/components/ui/toast";
import { TextLink } from "@/components/ui/text-link";
import { ChipMenu } from "@/components/rates/chip-menu";
import { formatDate } from "@/lib/format";

// Ranked, searchable provider rate-directory — every provider we hold rates
// for, their payer breadth + best per-session negotiated rate per code. Rates
// are per-session, not revenue; they never sum across payers or codes.
export function RateDirectory({ providers }: { providers: RatedProvider[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [professions, setProfessions] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toast = useToast();

  // The professions actually present in the rated set — a facet derived from
  // the data, so a profession we hold no rates for is never offered.
  const professionOptions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const p of providers) {
      if (!p.profession) continue;
      seen.set(p.profession, (seen.get(p.profession) ?? 0) + 1);
    }
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value]) => ({ value, label: shortProfession(value) }));
  }, [providers]);

  const sorted = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtered = providers.filter(
      (p) =>
        (professions.length === 0 || (p.profession != null && professions.includes(p.profession))) &&
        (!t || p.name.toLowerCase().includes(t) || p.npi.includes(t) || (p.profession ?? "").toLowerCase().includes(t)),
    );
    // Breadth-first is the ranking this page exists for; DataTable's own header
    // sort takes over from here.
    return [...filtered].sort((a, b) => b.payerCount - a.payerCount);
  }, [providers, q, professions]);

  const money = (v: number | null) => (v == null ? "—" : `$${v.toFixed(2)}`);
  const go = (p: RatedProvider) => router.push(p.slug ? `/directory/${p.slug}` : `/rates?npi=${p.npi}`);

  const columns: DataTableColumn<RatedProvider>[] = [
    {
      key: "provider",
      label: "Provider",
      fixed: true,
      sortValue: (p) => displayName(p.name),
      render: (p) => (
        <TextLink href={p.slug ? `/directory/${p.slug}` : `/rates?npi=${p.npi}`} onClick={(e) => e.stopPropagation()} variant="name">
          {displayName(p.name)}
        </TextLink>
      ),
    },
    { key: "type", label: "Type", sortValue: (p) => p.profession ?? "", render: (p) => <span className="text-text-muted">{shortProfession(p.profession)}</span> },
    { key: "breadth", label: "Books", sortValue: (p) => p.payerCount, render: (p) => <Badge variant={p.payerCount >= 4 ? "info" : "neutral"}>{p.payerCount}</Badge> },
    { key: "b90791", label: "Eval", headTitle: "90791 — diagnostic evaluation", align: "right", sortValue: (p) => p.best90791 ?? -1, render: (p) => <span className="text-text-body">{money(p.best90791)}</span> },
    // 90834 is the most-billed psychotherapy code; it was fetched all along and
    // never shown, which made "Therapy rate" read as THE therapy rate.
    { key: "b90834", label: "Therapy 45m", headTitle: "90834 — psychotherapy, 45 minutes", align: "right", sortValue: (p) => p.best90834 ?? -1, render: (p) => <span className="font-medium text-text">{money(p.best90834)}</span> },
    { key: "b90837", label: "Therapy 60m", headTitle: "90837 — psychotherapy, 60 minutes", align: "right", sortValue: (p) => p.best90837 ?? -1, render: (p) => <span className="font-medium text-text">{money(p.best90837)}</span> },
    { key: "b90853", label: "Group", headTitle: "90853 — group psychotherapy", align: "right", defaultHidden: true, sortValue: (p) => p.best90853 ?? -1, render: (p) => <span className="text-text-body">{money(p.best90853)}</span> },
    { key: "b99214", label: "Med-mgmt", headTitle: "99214 — established patient, moderate complexity", align: "right", sortValue: (p) => p.best99214 ?? -1, render: (p) => <span className="text-text-body">{money(p.best99214)}</span> },
    { key: "asOf", label: "As of", defaultHidden: true, sortValue: (p) => p.asOf ?? "", render: (p) => <span className="text-text-muted">{p.asOf ? formatDate(p.asOf) : "—"}</span> },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* One tab: the three that sat beside it were named "Tab 2/3/4" and
          filtered nothing \u2014 switching them changed the underline and nothing
          else. */}
      <IndexHeader
        tabs={[{ key: "all", label: "All Providers" }]}
        active="all"
        newLabel="New shortlist"
        onNew={() => toast("New shortlist isn\u2019t wired up yet.", "info")}
      />

      <DataTable
        columns={columns}
        rows={sorted}
        rowKey={(p) => p.npi}
        storageKey="recruiting.columns"
        defaultSort={{ col: "breadth", dir: "desc" }}
        lazy
        fillHeight
        className="min-h-0 flex-1"
        onRowClick={(p) => go(p)}
        selected={selected}
        onSelectedChange={setSelected}
        onExport={() => toast("Export isn\u2019t wired up yet.", "info")}
        onRefresh={() => router.refresh()}
        filter={
          <ChipMenu
            label="Filter"
            icon="list-filter"
            options={professionOptions}
            values={professions}
            onToggle={(v) =>
              setProfessions((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
            }
            onClear={() => setProfessions([])}
          />
        }
        rowActions={(p) => (
          <KebabMenu label={`Actions for ${displayName(p.name)}`}>
            <MenuItem icon="person-circle" label="Open provider" onClick={() => go(p)} />
          </KebabMenu>
        )}
        toolbarLeft={
          <>
            <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search providers by name or NPI…" className="max-w-md flex-1" />
            <span className="self-center text-sm text-text-muted tabular-nums">
              {sorted.length.toLocaleString()} of {providers.length.toLocaleString()} rated providers
            </span>
          </>
        }
        footnote={
          <p className="text-[12px] text-text-muted">
            Best per-session negotiated rate the provider commands across the NY payer books we index. Per-session, not revenue &mdash; rates never sum across payers or codes. As published; presence isn&rsquo;t proof of an open panel.
          </p>
        }
      />
    </div>
  );
}

// NPPES stores "LAST FIRST [MIDDLE] [SUFFIX]"; show "First Last". Heuristic:
// strip trailing credential suffixes, move the first token to the end.
const SUFFIX = /\b(LCSW|LMHC|LMFT|LCAT|PHD|PSYD|MD|DO|NP|PMHNP|CRNP|RN|MSW|PC|PLLC)\b/gi;
function displayName(raw: string): string {
  const clean = raw.replace(SUFFIX, "").replace(/\s+/g, " ").trim();
  const parts = clean.split(" ");
  const reordered = parts.length >= 2 ? [...parts.slice(1), parts[0]] : parts;
  return reordered.map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

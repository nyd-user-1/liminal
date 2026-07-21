"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tag } from "@/components/ui/tag";
import { downloadCsv } from "@/lib/csv";
import { InsurerMark } from "./insurer-mark";

// Networks + the network crosswalk. Three competing designs for the mapping
// surface, stacked for a bake-off, plus the 72-row roster.
//
// All three options render the SAME rows from the SAME fetch — no option gets an
// easier slice of the data than another, or the comparison would be rigged. The
// data is fetched once by NetworkPanels and handed down.
//
// Table standard: ten rows in a height-bounded scroll, sticky header, no pager
// (docs/rules/table-standard.md). 1,563 rows is under the "few thousand" line,
// so the whole set is fetched and sorted/searched client-side; `lazy` grows the
// DOM as the reader scrolls.

// ── shared ──────────────────────────────────────────────────────────────────

type MappingStatus = "mapped" | "ambiguous" | "unmapped";

export interface MappingRow {
  id: string;
  status: MappingStatus;
  source: string;
  payerLabel: string;
  networkLabel: string;
  networkName: string | null;
  rule: string;
  scope: string | null;
  weight: number | null;
  insurerId: string | null;
  insurerName: string | null;
  bucketedAt: string | null;
  parts: string[];
}

export interface NetworkRow {
  id: string;
  name: string;
  kind: string;
  insurerName: string | null;
  administratorName: string | null;
  notes: string | null;
  mappedLabels: number;
}

export interface NetworkData {
  networks: NetworkRow[];
  mappings: MappingRow[];
  counts: { mapped: number; ambiguous: number; unmapped: number; total: number };
  queryMs: number;
  generatedAt: number;
}

const TABLE_H = "max-h-[512px]";

const STATUS_LABEL: Record<MappingStatus, string> = {
  mapped: "Mapped",
  ambiguous: "Ambiguous",
  unmapped: "Unmapped",
};

// Status colour on theme tokens. Ambiguous is a warning, not a failure: the
// label resolved to a bucket, it just names several networks at once.
const STATUS_DOT: Record<MappingStatus, string> = {
  mapped: "bg-success",
  ambiguous: "bg-warning",
  unmapped: "bg-danger",
};
const STATUS_BADGE: Record<MappingStatus, "success" | "warning" | "danger"> = {
  mapped: "success",
  ambiguous: "warning",
  unmapped: "danger",
};

/** How the mapping was decided, in words. `alias` is a curated crosswalk entry;
 *  `pattern:*` is a rule bucketing it; `unresolved` is nothing having matched.
 *  There is no hand-curated provenance in the data — see the report. */
function provenance(rule: string): { label: string; hue: "green" | "blue" | "grey" } {
  if (rule === "alias") return { label: "alias-matched", hue: "green" };
  if (rule.startsWith("pattern:")) return { label: `rule-bucketed · ${rule.slice(8)}`, hue: "blue" };
  return { label: "unresolved", hue: "grey" };
}

const num = (n: number | null): string => (n === null ? "—" : n.toLocaleString("en-US"));
const day = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

/** Footer stamp every option carries, naming its own source tables. */
function sourceLine(d: NetworkData): string {
  return `network_aliases + network_unmapped_labels + payer_network_map · ${d.queryMs}ms`;
}

const SEARCH = (m: MappingRow) =>
  `${m.payerLabel} ${m.networkLabel} ${m.networkName ?? ""} ${m.rule} ${m.scope ?? ""} ${m.insurerName ?? ""}`.toLowerCase();

// ── OPTION 1 — status-grouped monitor ───────────────────────────────────────
// Triage: what needs attention, grouped by how bad it is. Filter-count chips,
// a two-column body (label + provenance on the left, relationship on the right),
// checkbox selection and a bulk-action bar.

function Option1({ data }: { data: NetworkData }) {
  const [status, setStatus] = useState<MappingStatus | "all">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.mappings.filter(
      (m) => (status === "all" || m.status === status) && (!s || SEARCH(m).includes(s)),
    );
  }, [data.mappings, status, q]);

  const groups: MappingStatus[] =
    status === "all" ? ["unmapped", "ambiguous", "mapped"] : [status];

  const columns: DataTableColumn<MappingRow>[] = [
    {
      key: "label",
      label: "Payer-reported label",
      fixed: true,
      sortValue: (m) => m.networkLabel,
      render: (m) => (
        <div className="flex min-w-0 flex-col gap-0.5 py-1">
          {/* Ambiguous labels are the point of this surface — they are shown in
              full, wrapped, never truncated into uselessness. */}
          <span className={`text-text ${m.status === "ambiguous" ? "whitespace-normal" : "truncate"}`}>
            {m.networkLabel}
          </span>
          <span className="text-[12px] text-text-muted">
            {m.source} · {m.payerLabel} · {num(m.weight)} rows
          </span>
        </div>
      ),
    },
    {
      key: "resolves",
      label: "Resolves to",
      sortValue: (m) => m.networkName ?? m.scope ?? "~",
      render: (m) => (
        <div className="flex min-w-0 flex-col gap-1 py-1">
          {m.networkName ? (
            <span className="flex items-center gap-1.5">
              <span className={`size-2 shrink-0 rounded-[2px] ${STATUS_DOT.mapped}`} />
              <span className="truncate text-text">{m.networkName}</span>
            </span>
          ) : m.status === "ambiguous" ? (
            // Every named network in the joined label, each with its own square.
            m.parts.map((p, i) => (
              <span key={`${p}-${i}`} className="flex items-center gap-1.5">
                <span className={`size-2 shrink-0 rounded-[2px] ${STATUS_DOT.ambiguous}`} />
                <span className="truncate text-text-body">{p}</span>
              </span>
            ))
          ) : (
            <span className="flex items-center gap-1.5">
              <span className={`size-2 shrink-0 rounded-[2px] ${STATUS_DOT.unmapped}`} />
              <span className="truncate text-text-muted">
                {m.scope ? `bucketed ${m.scope}` : "no network"}
              </span>
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceChip label={`All ${data.counts.total}`} selected={status === "all"} onSelect={() => setStatus("all")} />
        {(["mapped", "ambiguous", "unmapped"] as const).map((s) => (
          <ChoiceChip
            key={s}
            label={`${STATUS_LABEL[s]} ${data.counts[s]}`}
            selected={status === s}
            onSelect={() => setStatus(s)}
          />
        ))}
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search labels"
          className="ml-auto w-full sm:w-64"
        />
      </div>

      {groups.map((g) => {
        const gr = rows.filter((m) => m.status === g);
        if (gr.length === 0) return null;
        return (
          <div key={g} className={`flex ${TABLE_H} min-w-0 flex-col`}>
            <DataTable
              columns={columns}
              rows={gr}
              rowKey={(m) => m.id}
              fillHeight
              lazy
              stacked
              collapseActions
              title={STATUS_LABEL[g]}
              status={{ variant: STATUS_BADGE[g], label: `${gr.length}` }}
              source={sourceLine(data)}
              updatedAt={`${data.counts[g]} total · ${g === "mapped" ? "resolves to one of our 72 networks" : g === "ambiguous" ? "one label naming several networks" : "no network resolved"}`}
              selected={selected}
              onSelectedChange={setSelected}
            />
          </div>
        );
      })}

      {rows.length === 0 && (
        <EmptyState icon="search" title="No labels match" subtext="Clear the search or pick another status." />
      )}

      {/* Bulk-action bar — floats over the section while a selection exists. */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20 flex justify-center">
          <Card className="flex items-center gap-3 !py-2.5 shadow-menu">
            <span className="text-sm text-text">{selected.size} selected</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "network-labels",
                  ["status", "source", "payer_label", "network_label", "network", "rule", "weight"],
                  data.mappings
                    .filter((m) => selected.has(m.id))
                    .map((m) => [m.status, m.source, m.payerLabel, m.networkLabel, m.networkName ?? "", m.rule, String(m.weight ?? "")]),
                )
              }
            >
              Export selected
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── OPTION 2 — directory table ──────────────────────────────────────────────
// Scanning and filtering one flat list: a column per fact, dropdown filters, an
// export in the corner, rows grouped under tier headers.

function Option2({ data }: { data: NetworkData }) {
  const [q, setQ] = useState("");
  const [insurer, setInsurer] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");

  const insurers = useMemo(
    () =>
      [...new Set(data.mappings.map((m) => m.insurerName).filter(Boolean))].sort((a, b) =>
        a!.localeCompare(b!, "en"),
      ) as string[],
    [data.mappings],
  );

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.mappings.filter(
      (m) =>
        (!insurer || m.insurerName === insurer) &&
        (!source || m.source === source) &&
        (!status || m.status === status) &&
        (!s || SEARCH(m).includes(s)),
    );
  }, [data.mappings, q, insurer, source, status]);

  const tiers: MappingStatus[] = status
    ? [status as MappingStatus]
    : ["mapped", "ambiguous", "unmapped"];

  const columns: DataTableColumn<MappingRow>[] = [
    {
      key: "insurer",
      label: "Insurer",
      fixed: true,
      sortValue: (m) => m.insurerName ?? "~",
      render: (m) => (
        <span className="flex min-w-0 items-center gap-2">
          <InsurerMark id={m.insurerId} name={m.insurerName ?? m.payerLabel} size="sm" />
          <span className="truncate text-text">{m.insurerName ?? "—"}</span>
        </span>
      ),
    },
    {
      key: "label",
      label: "Payer label",
      cellClassName: "max-w-[220px]",
      sortValue: (m) => m.networkLabel,
      render: (m) => (
        <span className="block truncate font-mono text-[12px] text-text-body" title={m.networkLabel}>
          {m.networkLabel}
        </span>
      ),
    },
    {
      key: "network",
      label: "Resolved network",
      // Bounded so the Mapped group, whose network names are the longest, does
      // not push the last column past the table's right edge.
      cellClassName: "max-w-[200px] truncate",
      sortValue: (m) => m.networkName ?? "~",
      render: (m) =>
        m.networkName ? (
          <span className="text-text">{m.networkName}</span>
        ) : (
          <span className="text-text-muted">{m.scope ?? "—"}</span>
        ),
    },
    {
      key: "source",
      label: "Source",
      sortValue: (m) => m.source,
      render: (m) => <Tag hue={m.source === "mrf" ? "teal" : "violet"}>{m.source}</Tag>,
    },
    {
      key: "weight",
      label: "Rows",
      align: "right",
      sortValue: (m) => m.weight ?? -1,
      render: (m) => <span className="tabular-nums text-text-body">{num(m.weight)}</span>,
    },
    {
      key: "seen",
      label: "Bucketed",
      align: "right",
      sortValue: (m) => m.bucketedAt ?? "",
      render: (m) => <span className="tabular-nums text-text-muted">{day(m.bucketedAt)}</span>,
    },
  ];

  const opt = (vals: string[]) => [{ value: "", label: "All" }, ...vals.map((v) => ({ value: v, label: v }))];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Select className="w-48" options={opt(insurers)} value={insurer} onValueChange={setInsurer} placeholder="Insurer" />
        <Select className="w-36" options={opt(["mrf", "fhir"])} value={source} onValueChange={setSource} placeholder="Source" />
        <Select
          className="w-40"
          options={opt(["mapped", "ambiguous", "unmapped"])}
          value={status}
          onValueChange={setStatus}
          placeholder="Status"
        />
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="ml-auto w-full sm:w-56"
        />
      </div>

      {tiers.map((t) => {
        const tr = rows.filter((m) => m.status === t);
        if (tr.length === 0) return null;
        return (
          <div key={t} className={`flex ${TABLE_H} min-w-0 flex-col`}>
            <DataTable
              columns={columns}
              rows={tr}
              rowKey={(m) => m.id}
              fillHeight
              lazy
              stacked
              collapseActions
              title={STATUS_LABEL[t]}
              status={{ variant: STATUS_BADGE[t], label: `${tr.length}` }}
              source={sourceLine(data)}
              updatedAt={`${data.counts[t]} total`}
              onExport={() =>
                downloadCsv(
                  `network-mapping-${t}`,
                  ["insurer", "payer_label", "network_label", "network", "source", "weight", "bucketed_at"],
                  tr.map((m) => [
                    m.insurerName ?? "",
                    m.payerLabel,
                    m.networkLabel,
                    m.networkName ?? "",
                    m.source,
                    String(m.weight ?? ""),
                    m.bucketedAt ?? "",
                  ]),
                )
              }
            />
          </div>
        );
      })}

      {rows.length === 0 && (
        <EmptyState icon="list-filter" title="Nothing matches those filters" subtext="Widen one of them." />
      )}
    </div>
  );
}

// ── OPTION 3 — record-detail ────────────────────────────────────────────────
// Explaining WHY a mapping exists: the crosswalk's own stats up top, tabs with
// counts, and a provenance chip on every row. Ambiguous labels expand fully.

function Option3({ data }: { data: NetworkData }) {
  const [tab, setTab] = useState<MappingStatus>("ambiguous");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const mappedPct = data.counts.total ? (data.counts.mapped / data.counts.total) * 100 : 0;

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.mappings.filter((m) => m.status === tab && (!s || SEARCH(m).includes(s)));
  }, [data.mappings, tab, q]);

  const stats = [
    { label: "Labels seen", value: data.counts.total.toLocaleString("en-US") },
    { label: "Mapped", value: `${mappedPct.toFixed(1)}%`, sub: `${data.counts.mapped} of ${data.counts.total}` },
    { label: "Unmapped", value: data.counts.unmapped.toLocaleString("en-US") },
    { label: "Ambiguous", value: data.counts.ambiguous.toLocaleString("en-US") },
  ];

  const columns: DataTableColumn<MappingRow>[] = [
    {
      key: "label",
      label: "Label",
      fixed: true,
      // Bounded on purpose: unbounded, a 950-character label pushed the
      // provenance column — this option's entire reason to exist — off the
      // right edge. Collapsed it truncates; expanded it prints every part.
      cellClassName: "max-w-[520px]",
      sortValue: (m) => m.networkLabel,
      render: (m) => {
        const expanded = open === m.id;
        const joined = m.parts.length > 1;
        return (
          <div className="flex min-w-0 flex-col gap-1 py-1">
            <span className={`text-text ${expanded ? "whitespace-normal" : "truncate"}`}>
              {m.networkLabel}
            </span>
            {joined && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(expanded ? null : m.id);
                }}
                className="self-start text-[12px] text-primary hover:underline"
              >
                {expanded ? "Collapse" : `${m.parts.length} networks in one label — expand`}
              </button>
            )}
            {expanded && (
              <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-5 text-[13px] text-text-body">
                {m.parts.map((p, i) => (
                  <li key={`${p}-${i}`}>{p}</li>
                ))}
              </ol>
            )}
          </div>
        );
      },
    },
    {
      key: "payer",
      label: "Payer",
      sortValue: (m) => m.insurerName ?? m.payerLabel,
      render: (m) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-text">{m.insurerName ?? "—"}</span>
          <span className="truncate text-[12px] text-text-muted">{m.payerLabel}</span>
        </span>
      ),
    },
    {
      key: "provenance",
      label: "How we know",
      sortValue: (m) => m.rule,
      render: (m) => {
        const p = provenance(m.rule);
        return (
          <span className="flex min-w-0 flex-col gap-1">
            <Tag hue={p.hue}>{p.label}</Tag>
            {m.networkName && <span className="truncate text-[12px] text-text-muted">→ {m.networkName}</span>}
          </span>
        );
      },
    },
    {
      key: "weight",
      label: "Rows",
      align: "right",
      sortValue: (m) => m.weight ?? -1,
      render: (m) => <span className="tabular-nums text-text-body">{num(m.weight)}</span>,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Card className="flex flex-wrap gap-x-10 gap-y-4 !p-5">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col">
            <span className="text-sm text-text-muted">{s.label}</span>
            <span className="text-[26px] font-bold leading-tight tabular-nums text-text">{s.value}</span>
            {s.sub && <span className="text-[13px] text-text-muted">{s.sub}</span>}
          </div>
        ))}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {(["ambiguous", "unmapped", "mapped"] as const).map((s) => (
          <ChoiceChip
            key={s}
            label={`${STATUS_LABEL[s]} ${data.counts[s]}`}
            selected={tab === s}
            onSelect={() => {
              setTab(s);
              setOpen(null);
            }}
          />
        ))}
        <Badge variant={STATUS_BADGE[tab]}>{STATUS_LABEL[tab]}</Badge>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search labels"
          className="ml-auto w-full sm:w-64"
        />
      </div>

      <div className={`flex ${TABLE_H} min-w-0 flex-col`}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(m) => m.id}
          fillHeight
          lazy
          stacked
          collapseActions
          title={`${STATUS_LABEL[tab]} labels`}
          status={{ variant: STATUS_BADGE[tab], label: `${rows.length}` }}
          source={sourceLine(data)}
          updatedAt="provenance from the rule that decided each row"
        />
      </div>
    </div>
  );
}

// ── the Networks roster (one build, Option 2's shape) ───────────────────────

export function NetworksTable({ data }: { data: NetworkData }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data.networks;
    return data.networks.filter((n) =>
      `${n.name} ${n.insurerName ?? ""} ${n.administratorName ?? ""} ${n.kind} ${n.notes ?? ""}`
        .toLowerCase()
        .includes(s),
    );
  }, [data.networks, q]);

  const columns: DataTableColumn<NetworkRow>[] = [
    {
      key: "name",
      label: "Network",
      fixed: true,
      sortValue: (n) => n.name,
      render: (n) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-text">{n.name}</span>
          {n.notes && <span className="truncate text-[12px] text-text-muted">{n.notes}</span>}
        </div>
      ),
    },
    {
      key: "insurer",
      label: "Insurer",
      sortValue: (n) => n.insurerName ?? "~",
      render: (n) => (
        <span className="flex min-w-0 items-center gap-2">
          <InsurerMark id={null} name={n.insurerName ?? "—"} size="sm" />
          <span className="truncate text-text-body">{n.insurerName ?? "—"}</span>
        </span>
      ),
    },
    {
      key: "admin",
      label: "Administrator",
      sortValue: (n) => n.administratorName ?? "~",
      render: (n) => <span className="text-text-body">{n.administratorName ?? "—"}</span>,
    },
    {
      key: "kind",
      label: "Kind",
      sortValue: (n) => n.kind,
      render: (n) => <Tag hue={n.kind === "product" ? "blue" : "teal"}>{n.kind}</Tag>,
    },
    {
      key: "labels",
      label: "Payer labels",
      align: "right",
      sortValue: (n) => n.mappedLabels,
      render: (n) => (
        <span className={`tabular-nums ${n.mappedLabels ? "text-text-body" : "text-text-muted"}`}>
          {n.mappedLabels}
        </span>
      ),
    },
  ];

  return (
    <div className={`flex ${TABLE_H} min-w-0 flex-col`}>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(n) => n.id}
        fillHeight
        lazy
        stacked
        collapseActions
        title="Networks"
        status={{ variant: "info", label: `${data.networks.length}` }}
        source="networks + insurers · payer-label counts from network_aliases"
        updatedAt={
          <>
            {data.networks.filter((n) => n.mappedLabels > 0).length} of {data.networks.length} have a
            payer label mapped to them
            {q.trim() && ` · ${rows.length} match${rows.length === 1 ? "" : "es"}`}
          </>
        }
        toolbarLeft={
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search networks"
            className="w-full sm:w-60"
          />
        }
      />
    </div>
  );
}

// ── the loader + the bake-off ───────────────────────────────────────────────

/**
 * `crosswalk` decides which half the server runs. The Networks tab needs only
 * the 72-row roster (~18ms); the Network mapping tab needs the label crosswalk,
 * which groups over 13.7M rate rows. Fetching both for either meant the cheap
 * tab waited on the expensive one.
 */
export function useNetworkData(active: boolean, crosswalk = false) {
  const [data, setData] = useState<NetworkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Roster-only data can't satisfy the mapping tab, so a roster response must
  // not count as "already loaded" once the crosswalk is asked for.
  const satisfied = data !== null && (!crosswalk || data.mappings.length > 0 || data.counts.total > 0);

  useEffect(() => {
    if (!active || satisfied) return;
    let alive = true;
    setError(null);
    fetch(`/api/workspace/networks${crosswalk ? "?crosswalk=1" : ""}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load");
        if (alive) setData(j as NetworkData);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [active, crosswalk, satisfied]);

  return { data, error };
}

export function LoadingBlock({ error }: { error: string | null }) {
  if (error) {
    return <EmptyState icon="warning-triangle" title="Couldn't load the crosswalk" subtext={error} />;
  }
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-text-muted">
      <Spinner size={22} />
      <span className="text-sm">
        Reading the crosswalk — the unmapped half groups over 16.5M rate rows with no index that helps,
        measured at ~50s. It needs a matview (NYS-185); until then this is the honest wait, not a hang.
      </span>
    </div>
  );
}

const OPTIONS: { n: number; title: string; strength: string; render: (d: NetworkData) => React.ReactNode }[] = [
  {
    n: 1,
    title: "Status-grouped monitor",
    strength: "Triage — what needs attention, grouped by how bad it is.",
    render: (d) => <Option1 data={d} />,
  },
  {
    n: 2,
    title: "Directory table",
    strength: "Scanning and filtering a large flat list.",
    render: (d) => <Option2 data={d} />,
  },
  {
    n: 3,
    title: "Record detail",
    strength: "Explaining why a mapping exists.",
    render: (d) => <Option3 data={d} />,
  },
];

export function MappingBakeOff({ data }: { data: NetworkData }) {
  return (
    <div className="flex min-w-0 flex-col gap-10">
      <p className="text-sm text-text-muted">
        Three designs over the same {data.counts.total.toLocaleString("en-US")} rows — no option gets
        an easier slice of the data. Pick one; the other two get deleted.
      </p>
      {OPTIONS.map((o) => (
        <section key={o.n} className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border pt-4">
            <h3 className="text-[15px] font-semibold text-text">
              Option {o.n} · {o.title}
            </h3>
            <span className="text-sm text-text-muted">{o.strength}</span>
          </div>
          {o.render(data)}
        </section>
      ))}
    </div>
  );
}

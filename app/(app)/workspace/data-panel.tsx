"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/tag";
import type { DictionaryGroup, DictionaryTable } from "@/lib/repos/admin";
import type { SchemaCatalog, SchemaObject } from "@/lib/repos/schema-catalog";
import { CopyChip } from "./copy-chip";
import { EcoSection } from "./section";
import { SchemaTree } from "./schema-tree";

// Data — the platform inventory, now one tabbed section instead of a stacked
// wall of six groups.
//
//   Objects   the CURATED inventory: what each table means, in our words. The
//             six group titles survive the flattening as a badge on each card,
//             the same way the Rules families did when that section merged.
//   the rest  the LIVE schema, introspected per object type.
//
// Shape follows the data, deliberately:
//   · Objects is CARDS — every row carries a written meaning, a count and a
//     badge, which is a card's job.
//   · Tables/Views/Indexes/Functions/Triggers/Sequences are TABLES — uniform
//     name/detail/metric triples with nothing to describe, up to 237 of them.
//     Cards there would be 40 clicks of "View more" to read a list.
// All six live tabs are ≤237 rows: the whole set is fetched once and scrolls.
// No paging at all — see docs/rules/table-standard.md, paging is a fetch
// strategy for row counts a browser should not receive, never a UI.

const INITIAL = 6; // 3 columns × 2 rows

// Ten rows visible, the rest reached by scrolling — never by a pager. A MAX
// height, not a fixed one, so a two-row table sizes to its two rows instead of
// reserving an empty box; `fillHeight` bounds the Table's own overflow-auto to
// it and pins the header band while the body moves under it.
const TABLE_H = "max-h-[512px]";

type Tab =
  | "objects"
  | "tables"
  | "views"
  | "indexes"
  | "functions"
  | "triggers"
  | "sequences";

const TABS = [
  { key: "objects", label: "Objects" },
  { key: "tables", label: "Tables" },
  { key: "views", label: "Views" },
  { key: "indexes", label: "Indexes" },
  { key: "functions", label: "Functions" },
  { key: "triggers", label: "Triggers" },
  { key: "sequences", label: "Sequences" },
];

// Per-tab table chrome. `metricLabel` is null where the object type has no
// third value worth a column.
const TABLE_SPEC: Record<
  Exclude<Tab, "objects">,
  {
    title: string;
    nameLabel: string;
    detailLabel: string;
    metricLabel: string | null;
    empty: string;
  }
> = {
  tables: {
    title: "Tables",
    nameLabel: "Table",
    detailLabel: "Shape",
    metricLabel: "Rows",
    empty: "No base tables in the public schema.",
  },
  views: {
    title: "Views",
    nameLabel: "View",
    detailLabel: "Kind",
    metricLabel: "Size",
    empty: "No views or materialized views in the public schema.",
  },
  indexes: {
    title: "Indexes",
    nameLabel: "Index",
    detailLabel: "Table",
    metricLabel: "Size",
    empty: "No indexes in the public schema.",
  },
  functions: {
    title: "Stored procedures & functions",
    nameLabel: "Routine",
    detailLabel: "Kind",
    metricLabel: "Signature",
    empty: "We have written no stored procedures or functions of our own.",
  },
  triggers: {
    title: "Triggers",
    nameLabel: "Trigger",
    detailLabel: "Table",
    metricLabel: "Calls",
    empty: "No triggers are defined on any table.",
  },
  sequences: {
    title: "Sequences",
    nameLabel: "Sequence",
    detailLabel: "Type",
    metricLabel: null,
    empty:
      "No sequences — every key in this schema is a uuid or a natural key.",
  },
};

function formatCount(t: DictionaryTable): string {
  if (t.count === null) return "—";
  // Estimates carry a trailing "+" rather than an almost-equal glyph, so a real
  // count and an estimate look like the same kind of thing.
  return `${t.count.toLocaleString("en-US")}${t.countKind === "estimate" ? "+" : ""}`;
}

/** The card as one paste-ready line — what the Copy chip lifts. */
function copyText(t: DictionaryTable, group: string): string {
  const parts: string[] = [];
  if (t.planned) parts.push(`${t.name} — NOT BUILT YET (${t.planned})`);
  else if (t.missing) parts.push(`${t.name} — not yet loaded`);
  else parts.push(`${t.name} — ${formatCount(t)} rows`);
  parts.push(t.blurb ?? t.meaning);
  for (const f of t.facts ?? []) parts.push(`${f.label}: ${f.value}`);
  parts.push(`group: ${group}`);
  return parts.join(" · ");
}

/** One curated-inventory card. Fixed height with clamped body, so a long
 *  meaning can never make one card taller than the card beside it. The "powers"
 *  link that used to sit in the footer is gone — a card in a grid is one click
 *  target, not two. */
function ObjectCard({
  t,
  group,
  onOpen,
}: {
  t: DictionaryTable;
  group: string;
  onOpen: () => void;
}) {
  const dim = t.planned || t.missing;
  const facts = (t.facts ?? []).map((f) => `${f.label} ${f.value}`).join(" · ");

  return (
    <div className="group relative min-w-0">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        title="Open the tables behind this number"
        className="cursor-pointer rounded-card focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Card
          className={`flex h-[196px] min-w-0 flex-col gap-2 !p-5 transition-colors group-hover:border-primary/40 ${dim ? "opacity-70" : ""}`}
        >
          <div className="min-h-8">
            {t.planned ? (
              <Badge variant="neutral">Not built yet</Badge>
            ) : t.missing ? (
              <Badge variant="warning">Not yet loaded</Badge>
            ) : (
              <span className="text-[26px] font-bold leading-none tabular-nums text-text">
                {formatCount(t)}
              </span>
            )}
          </div>

          <p className="line-clamp-2 min-h-10 text-sm leading-5 text-text-muted">
            {t.blurb ?? t.meaning}
          </p>

          <span className="min-h-[18px] truncate text-[13px] leading-[18px] text-text-muted">
            {facts}
          </span>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-2.5">
            <p
              className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-wide text-text-muted"
              title={t.name}
            >
              {t.name}
            </p>
            <Tag hue="grey">{group}</Tag>
          </div>
        </Card>
      </div>
      <CopyChip text={copyText(t, group)} pos="bottom" />
    </div>
  );
}

/** One live-schema tab: a v2 DataTable over name/detail/metric triples, or an
 *  honest empty state naming what is absent. */
function SchemaPanel({
  spec,
  rows,
  footnote,
}: {
  spec: (typeof TABLE_SPEC)[Exclude<Tab, "objects">];
  rows: SchemaObject[];
  footnote?: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      `${r.name} ${r.detail} ${r.metric ?? ""}`.toLowerCase().includes(s),
    );
  }, [rows, q]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="grid"
        title={`No ${spec.title.toLowerCase()}`}
        subtext={spec.empty}
      />
    );
  }

  const columns: DataTableColumn<SchemaObject>[] = [
    {
      key: "name",
      label: spec.nameLabel,
      fixed: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="font-mono text-[12px] text-text">{r.name}</span>
      ),
    },
    {
      key: "detail",
      label: spec.detailLabel,
      sortValue: (r) => r.detail,
      render: (r) => <span className="text-text-body">{r.detail}</span>,
    },
    ...(spec.metricLabel
      ? [
          {
            key: "metric",
            label: spec.metricLabel,
            align: "right" as const,
            sortValue: (r: SchemaObject) => r.metric ?? "",
            render: (r: SchemaObject) => (
              <span className="tabular-nums text-text-body">
                {r.metric ?? "—"}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className={`flex ${TABLE_H} min-w-0 flex-col`}>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.name}
        fillHeight
        lazy
        stacked
        collapseActions
        title={spec.title}
        status={{ variant: "info", label: `${rows.length}` }}
        source="live schema · information_schema + pg_catalog"
        updatedAt={
          <>
            Read at page load
            {footnote ? ` · ${footnote}` : ""}
            {q.trim() &&
              ` · ${filtered.length} match${filtered.length === 1 ? "" : "es"}`}
          </>
        }
        toolbarLeft={
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${spec.nameLabel.toLowerCase()}s`}
            className="w-full sm:w-60"
          />
        }
      />
    </div>
  );
}

export function DataPanel({
  groups,
  catalog,
}: {
  groups: DictionaryGroup[];
  catalog: SchemaCatalog;
}) {
  const [tab, setTab] = useState<Tab>("objects");
  const [full, setFull] = useState(false);
  const [open, setOpen] = useState<DictionaryTable | null>(null);

  // The curated groups, flattened in their existing order, each card keeping
  // its group as a badge.
  const objects = useMemo(
    () =>
      groups
        .filter((g) => g.platform)
        .flatMap((g) => g.tables.map((t) => ({ t, group: g.title }))),
    [groups],
  );
  const shown = full ? objects : objects.slice(0, INITIAL);

  return (
    <EcoSection
      title="Data"
      info="What the platform is built on — the curated inventory in our own words under Objects, then the live schema exactly as Postgres reports it."
    >
      <div className="flex min-w-0 flex-col gap-4">
        <Tabs
          items={TABS}
          active={tab}
          onChange={(k) => {
            setTab(k as Tab);
            setFull(false);
          }}
          slideActive
        />

        {tab === "objects" ? (
          <>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map(({ t, group }) => (
                <ObjectCard
                  key={t.name}
                  t={t}
                  group={group}
                  onOpen={() => setOpen(t)}
                />
              ))}
            </div>
            {!full && objects.length > INITIAL && (
              <div>
                <Button variant="ghost" size="sm" onClick={() => setFull(true)}>
                  View more
                </Button>
              </div>
            )}
          </>
        ) : (
          <SchemaPanel
            spec={TABLE_SPEC[tab]}
            rows={catalog[tab]}
            // The gap between "69 routines in information_schema" and the 2 we
            // wrote is explained on the surface, not left to be discovered.
            footnote={
              tab === "functions" && catalog.extensionRoutines > 0
                ? `${catalog.extensionRoutines} more belong to extensions (pgcrypto, pg_trgm, pg_session_jwt, plpgsql)`
                : undefined
            }
          />
        )}
      </div>
      {open && (
        <SchemaTree
          root={open.name}
          title={open.name}
          onClose={() => setOpen(null)}
        />
      )}
    </EcoSection>
  );
}

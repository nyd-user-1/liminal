"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/tag";
import type { InsurerCard } from "@/lib/repos/insurers-board";
import { INSURER_LOGOS, InsurerMark } from "./insurer-mark";
import {
  LoadingBlock,
  MappingBakeOff,
  NetworksTable,
  useNetworkData,
} from "./network-panels";
import { EcoSection } from "./section";

// Insurers — the carrier registry as a card wall, in the "available frameworks"
// shape: a mark and a name up top, a factual line about what the thing is, and
// a metadata line or two beneath. No inline link in the footer
// (docs/rules/no-card-links.md).
//
// Every value on a card comes off `insurers` and its neighbours; nothing is
// scored or estimated. An insurer we know only by name shows only a name — a
// thin row is allowed to look thin, because the alternative is inventing a
// metric to fill the slot.

const INITIAL = 6; // 3 columns × 2 rows

const TABS = [
  { key: "insurers", label: "Insurers" },
  { key: "networks", label: "Networks" },
  { key: "mapping", label: "Network mapping" },
];

type Tab = "insurers" | "networks" | "mapping";

const compact = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
      : n.toLocaleString("en-US");

/** "Jul 18" — the T12:00:00 anchor keeps a date-only string from sliding a day
 *  backwards when the local timezone reads it. */
const shortDate = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** What the insurer IS, in one line, when the registry carries no note. Derived
 *  from the two columns we always have — never filler prose. */
function fallbackDescription(c: InsurerCard): string {
  const kind =
    c.kind === "group" ? "Insurer group" : c.kind === "administrator" ? "Administrator" : "Carrier";
  return c.parentName ? `${kind} under ${c.parentName}` : kind;
}

function InsurerTile({ c }: { c: InsurerCard }) {
  // Two metadata lines, each built only from what this row actually has. An
  // insurer with neither networks nor rates simply gets fewer lines.
  const structure = [
    c.networks > 0 && `${c.networks} network${c.networks === 1 ? "" : "s"}`,
    c.companies > 0 && `${c.companies} licensed ${c.companies === 1 ? "entity" : "entities"}`,
    c.naicGroupCode && `NAIC group ${c.naicGroupCode}`,
  ].filter(Boolean) as string[];

  const rates =
    c.rateRows !== null
      ? ([
          `${compact(c.rateRows)} rate rows`,
          c.rateNpis !== null && `${compact(c.rateNpis)} providers`,
          // Month + day only. The year would push this line into a truncation,
          // and every priced file we hold is from the current one.
          c.ratesAsOf && `priced ${shortDate(c.ratesAsOf)}`,
        ].filter(Boolean) as string[])
      : [];

  return (
    // Every slot below reserves its full height whether or not it is filled, so
    // a two-line insurer name or a missing rates line can never shift the
    // footer or push text past the card's edge. Uniform height AND width.
    <Card className="flex h-[228px] min-w-0 flex-col gap-3 !p-5">
      <div className="flex min-h-9 min-w-0 items-start gap-2.5">
        <InsurerMark id={c.id} name={c.name} />
        <p className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug text-text">
          {c.name}
        </p>
      </div>

      <p className="line-clamp-2 min-h-10 text-sm leading-5 text-text-muted">
        {c.notes ?? fallbackDescription(c)}
      </p>

      <div className="flex min-h-9 flex-col gap-0.5 text-[13px] leading-[18px] text-text-muted">
        {structure.length > 0 && <span className="truncate">{structure.join(" · ")}</span>}
        {rates.length > 0 && <span className="truncate">{rates.join(" · ")}</span>}
      </div>

      {/* Identifier left, category right — the same footer the Data cards use,
          and no link. See docs/rules/no-card-links.md: a small teal word in a
          card corner is neither a card-sized target nor a discoverable one. */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-2.5">
        <p
          className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-wide text-text-muted"
          title={c.id}
        >
          {c.id}
        </p>
        <Tag hue="grey">{c.kind}</Tag>
      </div>
    </Card>
  );
}

export function InsurersPanel({ insurers }: { insurers: InsurerCard[] }) {
  const [tab, setTab] = useState<Tab>("insurers");
  const [full, setFull] = useState(false);
  const net = useNetworkData(tab === "networks" || tab === "mapping", tab === "mapping");

  // Two blocks: insurers whose slug resolves to a real mark, then the rest,
  // each A–Z. No header between them — the marks running out IS the divider.
  //
  // The split is computed from the SAME `INSURER_LOGOS` map the mark renders
  // from (./insurer-mark), so
  // it cannot drift: add a mark and that insurer moves up on the next render;
  // rename an insurer and only its alphabetical position changes. There is no
  // second list to keep in sync, which is the failure mode a hand-maintained
  // order would have.
  const ordered = useMemo(
    () =>
      [...insurers].sort((a, b) => {
        const rank = (INSURER_LOGOS[a.id] ? 0 : 1) - (INSURER_LOGOS[b.id] ? 0 : 1);
        return rank !== 0 ? rank : a.name.localeCompare(b.name, "en");
      }),
    [insurers],
  );
  const shown = full ? ordered : ordered.slice(0, INITIAL);

  return (
    <EcoSection
      title="Insurers"
      info="The carrier registry — every row of the insurers table, with only the facts the schema already holds beside it: networks, NAIC-licensed entities, and rate rows where we have them."
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

        {tab === "insurers" && (
          <>
            {insurers.length === 0 ? (
              <EmptyState title="No insurers loaded" subtext="The insurers table is empty." />
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((c) => (
                  <InsurerTile key={c.id} c={c} />
                ))}
              </div>
            )}
            {!full && insurers.length > INITIAL && (
              <div>
                <Button variant="ghost" size="sm" onClick={() => setFull(true)}>
                  View more
                </Button>
              </div>
            )}
          </>
        )}

        {/* The crosswalk is fetched when one of these tabs is first opened, not
            during page render: its unmapped half groups over 13.7M rate rows and
            costs ~4.6s cold. Both tabs share one fetch. */}
        {tab === "networks" && (net.data ? <NetworksTable data={net.data} /> : <LoadingBlock error={net.error} />)}

        {tab === "mapping" && (net.data ? <MappingBakeOff data={net.data} /> : <LoadingBlock error={net.error} />)}

      </div>
    </EcoSection>
  );
}

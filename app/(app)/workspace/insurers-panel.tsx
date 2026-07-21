"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import type { InsurerCard } from "@/lib/repos/insurers-board";
import { EcoSection } from "./section";

// Insurers — the carrier registry as a card wall, in the "available frameworks"
// shape: a mark and a name up top, a factual line about what the thing is, a
// metadata line or two beneath, and one action at the foot.
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

/** Up to two letters from the name — a stand-in mark. We hold no carrier logos,
 *  and a monogram is honest where a borrowed logo would not be. */
function monogram(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

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

  const action =
    c.networks > 0
      ? { href: "/networks", label: "Networks" }
      : c.rateRows !== null
        ? { href: "/rates", label: "Rates" }
        : null;

  return (
    // Every slot below reserves its full height whether or not it is filled, so
    // a two-line insurer name or a missing rates line can never shift the
    // footer or push text past the card's edge. Uniform height AND width.
    <Card className="flex h-[228px] min-w-0 flex-col gap-3 !p-5">
      <div className="flex min-h-9 min-w-0 items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-primary-wash text-[13px] font-semibold text-primary-deep">
          {monogram(c.name)}
        </span>
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

      <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-border pt-2.5">
        <span className="truncate text-[13px] capitalize text-text-muted">{c.kind}</span>
        {action ? (
          <TextLink href={action.href} className="shrink-0 text-[13px]">
            {action.label}
          </TextLink>
        ) : (
          <span className="shrink-0 text-[13px] text-text-muted">Registry only</span>
        )}
      </div>
    </Card>
  );
}

export function InsurersPanel({
  insurers,
  networkRows,
}: {
  insurers: InsurerCard[];
  /** Row count of `networks` — quoted in the placeholder so an unbuilt view is
   *  never mistaken for an empty table. */
  networkRows: number | null;
}) {
  const [tab, setTab] = useState<Tab>("insurers");
  const [full, setFull] = useState(false);
  const shown = full ? insurers : insurers.slice(0, INITIAL);

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

        {/* Placeholders, deliberately. They say what exists in the database as
            well as what is missing here, so "not built" never reads as "no
            data". */}
        {tab === "networks" && (
          <EmptyState
            icon="globe"
            title="Networks view not built yet"
            subtext={
              networkRows === null
                ? "The networks table is not readable from here."
                : `${networkRows.toLocaleString("en-US")} rows already sit in the networks table — this surface for them is the missing piece, not the data.`
            }
          />
        )}

        {tab === "mapping" && (
          <EmptyState
            icon="link"
            title="Network mapping view not built yet"
            subtext="Which payer-reported network label resolves to which of our networks. The crosswalk exists in payer_network_map; the surface does not."
          />
        )}
      </div>
    </EcoSection>
  );
}

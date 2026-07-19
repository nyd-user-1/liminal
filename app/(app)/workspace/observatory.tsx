"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import type { DictionaryGroup, DictionaryTable } from "@/lib/repos/admin";
import { CopyChip } from "./copy-chip";
import { SchemaTree } from "./schema-tree";

// The observatory — the platform inventory as cards. Every card answers four
// questions in the same order: how much (the number), what is it (plain
// language), where does it show up (the page link), and where does it live
// (the table name, mono). Now every card also opens the shared schema-tree
// Dialog on click — the same tree the count cards up top open — while keeping
// its copy chip and its "powers" page link.
//
// The rows come from lib/repos/admin.ts — the same registry /admin/data
// renders as a table. This file is presentation only; nothing is computed here.

function formatCount(t: DictionaryTable): string {
  if (t.count === null) return "—";
  // Estimates carry a trailing "+" (a real count and an estimate should look
  // like the same kind of thing) rather than a leading almost-equal glyph.
  return `${t.count.toLocaleString("en-US")}${t.countKind === "estimate" ? "+" : ""}`;
}

/** The card as one terminal-paste-ready line — what the Copy chip lifts. Reads
 *  like the card, front to back. */
function copyText(t: DictionaryTable): string {
  const parts: string[] = [];
  if (t.planned) parts.push(`${t.name} — NOT BUILT YET (${t.planned})`);
  else if (t.missing) parts.push(`${t.name} — not yet loaded`);
  else parts.push(`${t.name} — ${formatCount(t)} rows`);
  parts.push(t.blurb ?? t.meaning);
  for (const f of t.facts ?? []) parts.push(`${f.label}: ${f.value}`);
  if (t.powers) parts.push(`powers ${t.powers.label} (${t.powers.href})`);
  return parts.join(" · ");
}

function TableCard({ t, onOpen }: { t: DictionaryTable; onOpen: () => void }) {
  const dim = t.planned || t.missing;
  return (
    <div className="group relative min-w-0">
      {/* A click anywhere but a link/button opens the schema tree — the same
          guard CopyCard uses, so the "powers" link and the Copy chip stay
          theirs. */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a,button")) return;
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        title="Open the tables behind this number"
        className="cursor-pointer rounded-card focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Card className={`flex h-full min-w-0 flex-col gap-3 p-5 transition-colors group-hover:border-primary/40 ${dim ? "opacity-70" : ""}`}>
          {t.planned ? (
            <Badge variant="neutral" className="self-start">
              Not built yet
            </Badge>
          ) : t.missing ? (
            <Badge variant="warning" className="self-start">
              Not yet loaded
            </Badge>
          ) : (
            <span className="text-[28px] font-bold leading-none tabular-nums text-text">{formatCount(t)}</span>
          )}

          <p className="flex-1 text-sm leading-relaxed text-text-muted">{t.blurb ?? t.meaning}</p>

          {t.facts && t.facts.length > 0 && (
            <dl className="flex flex-wrap gap-x-4 gap-y-1">
              {t.facts.map((f) => (
                <div key={f.label} className="flex items-baseline gap-1.5">
                  <dt className="text-[11px] uppercase tracking-wider text-text-muted">{f.label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-text">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* The teaching pair, on one line: the table it lives in → the page it
              powers. */}
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2.5">
            <p className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-wide text-text-muted" title={t.name}>
              {t.planned ? `${t.name} · ${t.planned}` : t.name}
            </p>
            {t.powers && (
              <TextLink href={t.powers.href} className="shrink-0 text-[13px]">
                {t.powers.label}
              </TextLink>
            )}
          </div>
        </Card>
      </div>
      <CopyChip text={copyText(t)} pos="bottom" />
    </div>
  );
}

export function Observatory({ groups }: { groups: DictionaryGroup[] }) {
  const [open, setOpen] = useState<DictionaryTable | null>(null);
  return (
    <>
      <div className="flex flex-col gap-8">
        {groups
          .filter((g) => g.platform)
          .map((g) => (
            <section key={g.title} className="flex flex-col gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-text">{g.title}</h3>
                {g.blurb && <p className="mt-0.5 text-sm text-text-muted">{g.blurb}</p>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.tables.map((t) => (
                  <TableCard key={t.name} t={t} onOpen={() => setOpen(t)} />
                ))}
              </div>
            </section>
          ))}
      </div>
      {open && <SchemaTree root={open.name} title={open.name} onClose={() => setOpen(null)} />}
    </>
  );
}

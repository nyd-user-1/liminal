"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { LibraryCard } from "@/components/ui/library-card";
import { Tabs } from "@/components/ui/tabs";
import { Tag, type TagHue } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { DocSheet } from "./doc-sheet";

// Agents, Reports and Rules — one section, three tabs, one card. Until now
// these were three separate groups with three near-identical grids
// (fleet-grid, rules-grid, the lone night-report card); they are the same
// gesture — a markdown document you open, read and edit — so they are now the
// same component, and a tab only changes which documents it lists.
//
// Every tab: LibraryCard (fixed height, so a long blurb can't make one card
// taller than its neighbours), two rows of three, then "View more". Every card:
// a kebab with "Copy as Markdown", and a click anywhere on the card opens the
// document in the shared DocSheet — the SAME doc-sheet.tsx the reports table and
// the agent identity files already use, not a fork of it.

export interface DocCard {
  /** Unique within its tab. */
  key: string;
  title: string;
  description: string;
  /** Chips bottom-left — the rule's category, the agent's model. */
  tags?: { label: string; hue: TagHue }[];
  /** Bottom-right, already formatted for reading. */
  date?: string;
  /** GET/PATCH {title, subtitle, bodyMd} — what the DocSheet opens. */
  endpoint: string;
  /** The sheet's window-chrome label. */
  sheetLabel: string;
  /** Source markdown for the clipboard. Null where the file isn't readable
   *  (a deployed build, where docs/ isn't traced in) — the card then copies its
   *  own text, so the action never sits there dead. */
  doc: string | null;
}

export type WorkbenchTab = "agents" | "reports" | "rules";

const TABS = [
  { key: "agents", label: "Agents" },
  { key: "reports", label: "Reports" },
  { key: "rules", label: "Rules" },
];

const INITIAL = 6; // 3 columns × 2 rows

export function WorkbenchGrid({
  agents,
  reports,
  rules,
}: {
  agents: DocCard[];
  reports: DocCard[];
  rules: DocCard[];
}) {
  const [tab, setTab] = useState<WorkbenchTab>("agents");
  const [full, setFull] = useState(false);
  const [open, setOpen] = useState<DocCard | null>(null);

  const cards = tab === "agents" ? agents : tab === "reports" ? reports : rules;
  const shown = full ? cards : cards.slice(0, INITIAL);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Tabs
        items={TABS}
        active={tab}
        onChange={(k) => {
          setTab(k as WorkbenchTab);
          setFull(false); // a new tab starts at two rows again
        }}
        slideActive
      />

      {cards.length === 0 ? (
        <p className="text-sm text-text-muted">Nothing here yet.</p>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <WorkbenchCard key={c.key} card={c} onOpen={() => setOpen(c)} />
          ))}
        </div>
      )}

      {!full && cards.length > INITIAL && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setFull(true)}>
            View more
          </Button>
        </div>
      )}

      {open && (
        <DocSheet endpoint={open.endpoint} label={open.sheetLabel} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function WorkbenchCard({ card, onOpen }: { card: DocCard; onOpen: () => void }) {
  const toast = useToast();

  const copy = async () => {
    const md = card.doc ?? `# ${card.title}\n\n${card.description}\n`;
    try {
      await navigator.clipboard.writeText(md);
      toast("Copied markdown", "success");
    } catch {
      toast("Couldn't copy — clipboard unavailable.", "danger");
    }
  };

  return (
    <LibraryCard
      title={card.title}
      description={card.description}
      date={card.date}
      onOpen={onOpen}
      tags={card.tags?.map((t) => (
        <Tag key={t.label} hue={t.hue}>
          {t.label}
        </Tag>
      ))}
      menu={
        <KebabMenu label={`${card.title} actions`}>
          <MenuItem icon="copy" label="Copy as Markdown" onClick={copy} />
        </KebabMenu>
      }
    />
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { LibraryCard } from "@/components/ui/library-card";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { RULE_TABS, type Rule, type RuleTab } from "@/lib/rules";
import { DocSheet } from "./doc-sheet";

// The Rules grid — the same gesture as the fleet roster next door: a uniform
// LibraryCard, two rows of three, "View more" for the rest, kebab to copy the
// markdown, and a click anywhere on the card to open the rule's source document
// in the DocSheet. One way to open a document across agents, reports and rules.

export interface RuleCardData extends Rule {
  /** Source doc text, for the clipboard. Null where docs/rules/<id>.md isn't readable. */
  doc: string | null;
  /** Last-modified of the source doc, ISO. Null alongside a null doc. */
  updatedAt: string | null;
}

const INITIAL = 6;

export function RulesGrid({ rules }: { rules: RuleCardData[] }) {
  const [tab, setTab] = useState<RuleTab>("design");
  const [full, setFull] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const inTab = rules.filter((r) => r.tab === tab);
  const shown = full ? inTab : inTab.slice(0, INITIAL);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Tabs
        items={RULE_TABS}
        active={tab}
        onChange={(k) => {
          setTab(k as RuleTab);
          setFull(false);
        }}
        slideActive
      />
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((r) => (
          <RuleCard key={r.id} rule={r} onOpen={() => setOpenId(r.id)} />
        ))}
      </div>
      {!full && inTab.length > INITIAL && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setFull(true)}>
            View more
          </Button>
        </div>
      )}
      {openId && (
        <DocSheet endpoint={`/api/rules/${openId}`} label="Rule" onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

function RuleCard({ rule, onOpen }: { rule: RuleCardData; onOpen: () => void }) {
  const toast = useToast();

  const copy = async () => {
    if (!rule.doc) return;
    try {
      await navigator.clipboard.writeText(rule.doc);
      toast("Copied markdown", "success");
    } catch {
      toast("Couldn't copy — clipboard unavailable.", "danger");
    }
  };

  return (
    <LibraryCard
      title={rule.title}
      description={rule.body}
      date={rule.updatedAt ? formatDate(rule.updatedAt) : undefined}
      onOpen={rule.doc ? onOpen : undefined}
      menu={
        rule.doc && (
          <KebabMenu label={`${rule.title} actions`}>
            <MenuItem icon="copy" label="Copy as Markdown" onClick={copy} />
          </KebabMenu>
        )
      }
    />
  );
}

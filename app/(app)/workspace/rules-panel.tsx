"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { RULE_TABS, RULES, type RuleTab } from "@/lib/rules";
import { EcoSection } from "./section";

// The standards that make ten independent terminals read like one hand, now a
// real system: three tabs (Design · Agent · Database), each a grid of its rules
// drawn from lib/rules.ts. Plumbing keeps the ecosystem alive; these keep it
// coherent — drop one and the surfaces drift, the facts fork, the fleet stops
// reading as a single author.

export function RulesPanel() {
  const [tab, setTab] = useState<RuleTab>("design");
  const shown = RULES.filter((r) => r.tab === tab);

  return (
    <EcoSection title="Rules">
      <div className="flex min-w-0 flex-col gap-4">
        <Tabs items={RULE_TABS} active={tab} onChange={(k) => setTab(k as RuleTab)} slideActive />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => (
            <Card key={r.id} className="flex min-w-0 flex-col gap-1 p-5">
              <h3 className="text-[15px] font-semibold text-text">{r.title}</h3>
              <p className="text-sm leading-relaxed text-text-muted">{r.body}</p>
              {r.link && (
                <TextLink href={r.link.href} className="mt-1.5 text-[13px]">
                  {r.link.label}
                </TextLink>
              )}
            </Card>
          ))}
        </div>
      </div>
    </EcoSection>
  );
}

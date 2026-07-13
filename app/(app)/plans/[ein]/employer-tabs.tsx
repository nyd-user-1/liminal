"use client";

import { type ReactNode, useState } from "react";
import { Tabs } from "@/components/ui/tabs";

export interface EmployerTab {
  key: string;
  label: string;
  count?: number;
  content: ReactNode;
}

// Mirrors ClientTabs: tab content is rendered server-side in page.tsx and
// slotted here; inactive tabs stay mounted (hidden) so nothing re-fetches.
export function EmployerTabs({
  tabs,
  initialTab,
}: {
  tabs: EmployerTab[];
  initialTab?: string;
}) {
  const valid = (k?: string) => (k && tabs.some((t) => t.key === k) ? k : undefined);
  const [active, setActive] = useState<string>(valid(initialTab) ?? tabs[0]?.key ?? "");

  return (
    <>
      <Tabs
        items={tabs.map(({ key, label, count }) => ({ key, label, count }))}
        active={active}
        onChange={setActive}
        slideActive
        className="mb-6"
      />
      {tabs.map((t) => (
        <div key={t.key} hidden={t.key !== active}>
          {t.content}
        </div>
      ))}
    </>
  );
}

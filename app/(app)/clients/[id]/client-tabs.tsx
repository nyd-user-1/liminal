"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";

// Client-record tab switcher. Content nodes are rendered server-side by
// page.tsx and slotted in here; inactive tabs stay mounted (hidden) so form
// state survives switching. `initialTab` (page.tsx reads ?tab=…) selects the
// starting tab and re-selects on soft navigations to the same page.

export interface ClientTab {
  key: string;
  label: string;
  count?: number;
  content: ReactNode;
}

export function ClientTabs({ tabs, initialTab }: { tabs: ClientTab[]; initialTab?: string }) {
  const valid = (key?: string) => (key && tabs.some((t) => t.key === key) ? key : undefined);
  const [active, setActive] = useState(valid(initialTab) ?? tabs[0]?.key);
  useEffect(() => {
    const next = valid(initialTab);
    if (next) setActive(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);
  return (
    <>
      <Tabs
        items={tabs.map(({ key, label, count }) => ({ key, label, count }))}
        active={active}
        onChange={setActive}
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

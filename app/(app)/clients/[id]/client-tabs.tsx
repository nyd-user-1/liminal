"use client";

import { useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";

// Client-record tab switcher. Content nodes are rendered server-side by
// page.tsx and slotted in here; inactive tabs stay mounted (hidden) so form
// state survives switching.

export interface ClientTab {
  key: string;
  label: string;
  count?: number;
  content: ReactNode;
}

export function ClientTabs({ tabs }: { tabs: ClientTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
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

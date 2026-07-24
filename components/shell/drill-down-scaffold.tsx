"use client";

import type { ReactNode } from "react";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { RECORD_RAIL_W } from "@/components/records/record-layout";

// The drill-down page skeleton (founder spec 2026-07-23): a full-width tab rail
// (index-page anatomy) resting ABOVE an object | content split, so the anchor
// "object panel" on the left and the active table/map on the right share a top
// edge and therefore a height. Every drill-down record uses it — /orgs/[tin],
// the directory provider, the plans employer — so the rail placement and the
// equal-height split are defined once here, not re-spelled per page.
//
// The caller owns the tab STATE and the content (its own TabReveal or hidden-
// mount strategy); this component owns only the geometry. It is the top-level
// element of the route content — h-full reads the scrolling <main>'s height.
export function DrillDownScaffold({
  object,
  tabs,
  active,
  onChange,
  children,
}: {
  /** The anchor panel — the identity card that names the record (left rail). */
  object: ReactNode;
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  /** The active tab's content. The caller wraps it (TabReveal / hidden mount). */
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs slideActive className="mb-4 shrink-0" active={active} onChange={onChange} items={tabs} />

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        <aside className={`flex min-h-0 flex-col gap-4 lg:h-full lg:shrink-0 ${RECORD_RAIL_W}`}>
          <div className="min-h-0 flex-1">{object}</div>
        </aside>

        {/* min-w-0 is load-bearing: without it the content grows past the
            viewport and the PAGE scrolls horizontally (Table standard). */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

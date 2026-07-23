"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, type TabItem } from "@/components/ui/tabs";

/**
 * The top half of the index page standard: the tab row, with the page's
 * actions (New) at its right end — one piece. Since the TopBar strip retired
 * (2026-07-23) the tab rail is the canonical home for an index page's "+ New";
 * nothing portals out of the page anymore. DataTable is the bottom half — it
 * already owns the toolbar, column picker, table and scroll.
 *
 * Thin on purpose. It decides nothing: no data, no filtering, no active-tab
 * state. If this file grows logic, the logic belongs in the page.
 *
 * The page identity is NOT here — the surface header's context switcher names
 * the page (components/shell/content-surface.tsx). The tab row carries the only
 * in-content list heading (see the Component Catalog's canonical layout rules).
 */
export function IndexHeader({
  tabs,
  active,
  onChange,
  onClose,
  overflow,
  overflowLabel,
  slideActive = true,
  newLabel,
  onNew,
  actions,
}: {
  tabs: TabItem[];
  active?: string;
  onChange?: (key: string) => void;
  /** Close handler for `closable` tabs (open-record tabs). */
  onClose?: (key: string) => void;
  /** Secondary tabs, parked behind a "View More" menu (see Tabs). */
  overflow?: TabItem[];
  overflowLabel?: string;
  /** Slide the underline between tabs. Off for `href` tab rows, which navigate. */
  slideActive?: boolean;
  /** The New button. Omit both to render no create action. */
  newLabel?: string;
  onNew?: () => void;
  /** Extra actions, rendered before New at the right end of the rail. */
  actions?: ReactNode;
}) {
  const trailing =
    actions || newLabel ? (
      <>
        {actions}
        {newLabel && (
          <Button size="sm" leftIcon="plus" onClick={onNew}>
            {newLabel}
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <Tabs
      className="mb-4 shrink-0"
      slideActive={slideActive}
      active={active}
      onChange={onChange}
      onClose={onClose}
      overflow={overflow}
      overflowLabel={overflowLabel}
      items={tabs}
      trailing={trailing}
    />
  );
}

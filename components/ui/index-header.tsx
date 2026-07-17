"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { useToast } from "@/components/ui/toast";

/**
 * The top half of the index page standard: the TopBar's actions (New + bell)
 * and the tab row, as one piece. DataTable is the bottom half — it already owns
 * the toolbar, column picker, table and scroll.
 *
 * Thin on purpose. It decides nothing: no data, no filtering, no active-tab
 * state. If this file grows logic, the logic belongs in the page.
 *
 * The H1 is NOT here — it stays route-derived in components/shell/topbar.tsx.
 * The tab row carries the only in-content list heading (see the Component
 * Catalog's canonical layout rules).
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
  /** Extra TopBar actions, rendered before New. */
  actions?: ReactNode;
}) {
  const toast = useToast();

  return (
    <>
      <TopBarActions>
        {actions}
        {newLabel && (
          <Button size="sm" leftIcon="plus" onClick={onNew}>
            {newLabel}
          </Button>
        )}
        <IconButton icon="bell" label="Notifications" onClick={() => toast("No new notifications.", "info")} />
      </TopBarActions>

      <Tabs
        className="mt-4 mb-4 shrink-0"
        slideActive={slideActive}
        active={active}
        onChange={onChange}
        onClose={onClose}
        overflow={overflow}
        overflowLabel={overflowLabel}
        items={tabs}
      />
    </>
  );
}

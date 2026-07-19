"use client";

import type { ReactNode } from "react";
import { AccountMenu } from "@/components/shell/account-menu";
import { TopBarBell } from "@/components/shell/topbar-bell";
import { OPEN_COMMAND_PALETTE } from "@/components/search/command-palette";
import { Icon } from "@/components/ui/icons";
import type { SessionUser } from "@/lib/auth";

// Catalog `TopBar` — the utility bar (warm-paper `bg-page`, forming the L-frame
// with the Sidebar; the white content panel tucks into their junction). It
// carries no page title: the route H1 now lives at the top of the content
// surface (ContentHeader). Left: the mobile hamburger + the ⌘K search
// affordance (workspace only). Right: the notification bell + the account menu.

export function TopBar({
  user,
  leading,
  showSearch = false,
}: {
  user: SessionUser;
  /** Slot before the search field — the mobile hamburger. */
  leading?: ReactNode;
  /** Show the ⌘K search trigger (workspace variant only — the palette is too). */
  showSearch?: boolean;
}) {
  return (
    <header className="flex h-[calc(4rem_+_env(safe-area-inset-top))] shrink-0 items-center gap-2 bg-page px-3 pt-[env(safe-area-inset-top)] md:gap-3 md:px-6">
      {leading}
      {showSearch && <SearchTrigger />}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <TopBarBell />
        <AccountMenu user={user} />
      </div>
    </header>
  );
}

// A search field in look, a button in behavior: it opens the ⌘K CommandPalette
// (which owns the actual search). Full "Search… ⌘K" pill at md+, icon-only on
// mobile so the utility bar stays uncramped.
function SearchTrigger() {
  const open = () => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search"
      className="group flex h-9 items-center gap-2 rounded-field border border-border bg-surface px-2.5 text-text-muted transition-colors hover:border-primary hover:text-text md:w-72"
    >
      <Icon name="search" size={18} className="shrink-0" />
      <span className="hidden text-[14px] md:inline">Search…</span>
      <kbd className="ml-auto hidden rounded-[5px] border border-border bg-canvas px-1.5 py-0.5 text-[12px] font-medium md:inline">
        ⌘K
      </kbd>
    </button>
  );
}

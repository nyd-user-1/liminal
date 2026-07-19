"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/shell/account-menu";
import { TopBarBell } from "@/components/shell/topbar-bell";
import { routeTitle } from "@/components/shell/route-title";
import { OPEN_COMMAND_PALETTE } from "@/components/search/command-palette";
import { Icon } from "@/components/ui/icons";
import type { SessionUser } from "@/lib/auth";

// Catalog `TopBar` — the utility bar (warm-paper `bg-page`, forming the L-frame
// with the Sidebar). No page title here: the route H1 lives at the top of the
// content surface (ContentHeader). Reads left → right (Stellate shape):
//
//   [Leuk › Section ⌄]  ···········  [Search… ⌘K]  [bell]  [account]
//
// The context pill and the search pill both open the ⌘K palette — its GO-TO
// destinations double as the section switcher. Both pills wear the light-on-
// paper treatment (bg-surface + border-border), not navy.

export function TopBar({
  user,
  leading,
  showSearch = true,
}: {
  user: SessionUser;
  /** Slot before the context pill — the mobile hamburger. */
  leading?: ReactNode;
  /** Show the ⌘K search pill. Off only where the palette isn't mounted (portal). */
  showSearch?: boolean;
}) {
  const pathname = usePathname();
  const section = routeTitle(pathname).title;
  return (
    <header className="flex h-[calc(4rem_+_env(safe-area-inset-top))] shrink-0 items-center gap-2 bg-page px-3 pt-[env(safe-area-inset-top)] md:gap-3 md:px-6">
      {leading}
      <ContextPill section={section} />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {showSearch && <SearchTrigger />}
        <TopBarBell />
        <AccountMenu user={user} />
      </div>
    </header>
  );
}

// The far-left context / switcher pill: brand › current section + a switcher
// chevron (Stellate's "Acme › Content API ⇅"). Opens the ⌘K palette, whose
// GO-TO list is the section switcher. Desktop-only — on mobile the hamburger +
// sidebar sheet carry the brand.
function ContextPill({ section }: { section: string }) {
  const open = () => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="menu"
      aria-label={`Leuk, ${section} — jump to a section`}
      className="hidden h-9 items-center gap-1.5 rounded-field border border-border bg-surface pl-3 pr-2 text-[14px] text-text transition-colors hover:border-primary md:flex"
    >
      <span className="font-semibold">Leuk</span>
      <Icon name="chevron-right" size={15} className="shrink-0 text-text-muted" />
      <span className="max-w-[180px] truncate font-medium">{section}</span>
      <Icon name="chevron-down" size={15} className="ml-0.5 shrink-0 text-text-muted" />
    </button>
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
      className="group flex h-9 items-center gap-2 rounded-field border border-border bg-surface px-2.5 text-text-muted transition-colors hover:border-primary hover:text-text md:w-64"
    >
      <Icon name="search" size={18} className="shrink-0" />
      <span className="hidden text-[14px] md:inline">Search…</span>
      <kbd className="ml-auto hidden rounded-[5px] border border-border bg-canvas px-1.5 py-0.5 text-[12px] font-medium md:inline">
        ⌘K
      </kbd>
    </button>
  );
}

"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TopBarBell } from "@/components/shell/topbar-bell";
import { routeTitle } from "@/components/shell/route-title";
import { OPEN_COMMAND_PALETTE } from "@/components/search/command-palette";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `TopBar` — the utility bar (warm-paper `bg-page`, forming the L-frame
// with the Sidebar). No page title here: the route H1 lives at the top of the
// content surface (ContentHeader). Reads left → right (Stellate / Vercel shape):
//
//   [Leuk › Section ⇅]  ···········  [Search… ⌘K]  [bell]
//
// The LEFT pill is a self-contained section switcher (its own anchored menu,
// Vercel "All Projects ⇅"). The RIGHT pill opens the global ⌘K palette. Both
// wear the light-on-paper treatment. The account chip is NOT here — it lives at
// the bottom of the Sidebar.

// Jump-to destinations for the switcher menu — the main app areas.
const SWITCH_DESTINATIONS: Array<{ label: string; href: string; icon: IconName }> = [
  { label: "Workspace", href: "/workspace", icon: "grid" },
  { label: "Calendar", href: "/calendar", icon: "calendar" },
  { label: "Inbox", href: "/inbox", icon: "inbox" },
  { label: "Clients", href: "/clients", icon: "users" },
  { label: "Prescriptions", href: "/prescriptions", icon: "pill-bottle" },
  { label: "Orders", href: "/orders", icon: "send" },
  { label: "Billing", href: "/billing", icon: "dollar" },
  { label: "Catalog", href: "/catalog", icon: "grid" },
  { label: "Library", href: "/library", icon: "clipboard" },
  { label: "Rates", href: "/rates", icon: "activity" },
  { label: "Directory", href: "/directory", icon: "globe" },
  { label: "Organizations", href: "/orgs", icon: "id-card" },
  { label: "Networks", href: "/networks", icon: "link" },
  { label: "Plans", href: "/plans", icon: "credit-card" },
  { label: "Recruiting", href: "/recruiting", icon: "users-round" },
  { label: "Settings", href: "/settings", icon: "gear" },
];

export function TopBar({
  leading,
}: {
  /** Slot before the context pill — the mobile hamburger. */
  leading?: ReactNode;
}) {
  const pathname = usePathname();
  const section = routeTitle(pathname).title;
  return (
    <header className="flex h-[calc(4rem_+_env(safe-area-inset-top))] shrink-0 items-center gap-2 bg-[#f6f6f7] px-3 pt-[env(safe-area-inset-top)] md:gap-3 md:px-6">
      {leading}
      <ContextSwitcher section={section} />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <SearchTrigger />
        <TopBarBell />
      </div>
    </header>
  );
}

// The far-left switcher pill (Vercel "All Projects ⇅"): brand › current section
// + a stacked up/down glyph. Click opens its OWN anchored menu — a "Find…" filter
// over a scrollable list of jump-to destinations — NOT the global ⌘K palette.
// Desktop-only; on mobile the hamburger + sidebar sheet carry the brand.
function ContextSwitcher({ section }: { section: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? SWITCH_DESTINATIONS.filter((d) => d.label.toLowerCase().includes(needle))
    : SWITCH_DESTINATIONS;

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Leuk, ${section} — switch section`}
        className={`flex h-9 items-center gap-1.5 rounded-field pl-3 pr-2 text-[14px] transition-colors ${
          open ? "bg-black/[0.04] text-primary" : "bg-black/[0.04] text-text-body hover:text-primary"
        }`}
      >
        <span className="font-semibold">Leuk</span>
        <Icon name="chevron-right" size={15} className="shrink-0 text-text-muted" />
        <span className="max-w-[180px] truncate font-medium">{section}</span>
        <span className="ml-0.5 flex shrink-0 flex-col text-text-muted" aria-hidden>
          <Icon name="chevron-up" size={12} className="-mb-[3px]" />
          <Icon name="chevron-down" size={12} className="-mt-[3px]" />
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-card border border-border bg-surface shadow-menu"
        >
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find…"
              aria-label="Find a section"
              className="w-full rounded-field bg-canvas px-2.5 py-1.5 text-[14px] text-text outline-none transition-shadow placeholder:text-text-muted focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filtered.length === 0 ? (
              <p className="px-2.5 py-3 text-sm text-text-muted">No matches.</p>
            ) : (
              filtered.map((d) => (
                <button
                  key={d.href}
                  type="button"
                  role="menuitem"
                  onClick={() => go(d.href)}
                  className="flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left text-[14px] font-medium text-text-body transition-colors hover:bg-[rgba(0,0,0,0.05)] hover:text-text"
                >
                  <Icon name={d.icon} size={18} className="shrink-0 text-text-muted" />
                  <span className="flex-1 truncate">{d.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
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
      className="group flex h-9 items-center gap-2 rounded-field bg-black/[0.04] px-2.5 text-text-muted transition-colors hover:text-primary md:w-64"
    >
      <Icon name="search" size={18} className="shrink-0" />
      <span className="hidden text-[14px] md:inline">Search…</span>
      <kbd className="ml-auto hidden rounded-[5px] border border-border bg-canvas px-1.5 py-0.5 text-[12px] font-medium md:inline">
        ⌘K
      </kbd>
    </button>
  );
}

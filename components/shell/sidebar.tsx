"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CountBadge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { Tooltip } from "@/components/ui/tooltip";

// Catalog `Sidebar` — the warm-paper column (part of the app L-frame with the
// TopBar): Logo + collapse chevron, then a config-driven nav list (icon + label
// + optional count). Active item = solid-teal pill; idle = navy ink on paper,
// teal-wash on hover. Collapses to an icon-only rail. The account menu is NOT
// here — it lives in the TopBar utility bar (AccountMenu).

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: IconName;
  count?: number;
}

export function Sidebar({
  items,
  homeHref = "/",
  sheet = false,
  onNavigate,
  className = "",
}: {
  items: SidebarNavItem[];
  homeHref?: string;
  /** Render as the mobile nav sheet: full-width, no collapse, safe-area padded. */
  sheet?: boolean;
  /** Called when a nav link is followed (the sheet closes itself). */
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const [collapsedState, setCollapsed] = useState(false);
  const collapsed = sheet ? false : collapsedState;

  // Longest-prefix wins: a parent route (e.g. /portal) is a prefix of all its
  // children (/portal/appointments), so match on the *most specific* item only
  // — otherwise "Home" would stay lit on every portal subpage.
  const matchLen = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? href.length : -1);
  const activeLen = Math.max(-1, ...items.map((i) => matchLen(i.href)));

  // Icon-only rail → every control gets the Tooltip chip (flying right, past
  // the rail) in place of the unstyleable native `title`.
  const withTip = (label: string, node: ReactNode) =>
    collapsed ? (
      <Tooltip label={label} placement="right" className="w-full">
        {node}
      </Tooltip>
    ) : (
      node
    );

  return (
    <aside
      className={`flex h-full shrink-0 flex-col bg-page ${
        sheet
          ? "w-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          : `transition-[width] duration-200 ${collapsed ? "w-[68px]" : "w-[248px]"}`
      } ${className}`}
    >
      <div className={`flex items-center py-5 ${collapsed ? "justify-center px-2" : "justify-between pl-5 pr-3"}`}>
        {!collapsed && (
          <Link href={homeHref} aria-label="Leuk home" onClick={onNavigate}>
            <Logo variant="onLight" size="sm" />
          </Link>
        )}
        {!sheet && (
          <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-field text-text-body transition-colors hover:bg-black/[0.04] hover:text-text"
            >
              <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={18} />
            </button>
          </Tooltip>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = activeLen >= 0 && matchLen(item.href) === activeLen;
          return (
            <div key={item.href}>
              {withTip(
                item.label,
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-label={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-field px-2.5 py-2.5 text-[15px] font-medium transition-colors ${
                    active ? "bg-primary text-white" : "text-text-body hover:bg-primary-wash/60 hover:text-text"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <Icon name={item.icon} className="shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.count !== undefined && <CountBadge count={item.count} />}
                    </>
                  )}
                </Link>,
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

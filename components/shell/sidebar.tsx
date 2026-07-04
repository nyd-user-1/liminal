"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CountBadge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { UserChip } from "@/components/ui/user-chip";
import type { SessionUser } from "@/lib/auth";

// Catalog `Sidebar` — fixed navy column: Logo + collapse chevron, config-
// driven SidebarItem list (icon + label + optional count Badge, active =
// navy-700 band + white), footer UserChip. Collapses to an icon-only rail.

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: IconName;
  count?: number;
}

export function Sidebar({
  items,
  user,
  homeHref = "/",
}: {
  items: SidebarNavItem[];
  user: SessionUser;
  homeHref?: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col bg-sidebar-bg transition-[width] duration-200 ${collapsed ? "w-[68px]" : "w-[248px]"}`}
    >
      <div className={`flex items-center py-5 ${collapsed ? "justify-center px-2" : "justify-between pl-5 pr-3"}`}>
        {!collapsed && (
          <Link href={homeHref} aria-label="Liminal home">
            <Logo variant="onNavy" size="sm" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-field text-sidebar-text transition-colors hover:bg-sidebar-active hover:text-white"
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-field px-2.5 py-2.5 text-[15px] font-medium transition-colors ${
                active ? "bg-sidebar-active text-white" : "text-sidebar-text hover:bg-sidebar-active/60 hover:text-white"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <Icon name={item.icon} className="shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.count !== undefined && <CountBadge count={item.count} />}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-sidebar-active p-3 ${collapsed ? "flex justify-center" : ""}`}>
        <UserChip name={user.name} hue={user.avatarHue} onNavy collapsed={collapsed} className="max-w-full" />
      </div>
    </aside>
  );
}

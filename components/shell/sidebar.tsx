"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, CountBadge } from "@/components/ui/badge";
import { DropdownMenu, MenuDivider, MenuItem } from "@/components/ui/dropdown-menu";
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
  sheet = false,
  onNavigate,
  className = "",
}: {
  items: SidebarNavItem[];
  user: SessionUser;
  homeHref?: string;
  /** Render as the mobile nav sheet: full-width, no collapse, safe-area padded. */
  sheet?: boolean;
  /** Called when a nav link is followed (the sheet closes itself). */
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsedState, setCollapsed] = useState(false);
  const collapsed = sheet ? false : collapsedState;

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  // ⌘, / Ctrl+, → Settings (honors the shortcut hint shown in the account menu).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        router.push("/settings");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col bg-sidebar-bg ${
        sheet
          ? "w-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          : `transition-[width] duration-200 ${collapsed ? "w-[68px]" : "w-[248px]"}`
      } ${className}`}
    >
      <div className={`flex items-center py-5 ${collapsed ? "justify-center px-2" : "justify-between pl-5 pr-3"}`}>
        {!collapsed && (
          <Link href={homeHref} aria-label="Liminal home" onClick={onNavigate}>
            <Logo variant="onNavy" size="sm" />
          </Link>
        )}
        {!sheet && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-field text-sidebar-text transition-colors hover:bg-sidebar-active hover:text-white"
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
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

      <div className="border-t border-sidebar-active p-3">
        <DropdownMenu
          label="Account menu"
          placement="top"
          align="left"
          width="w-64"
          triggerClassName={collapsed ? "flex w-full justify-center" : "w-full"}
          trigger={
            <UserChip name={user.name} hue={user.avatarHue} src={user.photoUrl} onNavy collapsed={collapsed} className="max-w-full" />
          }
        >
          {/* Identity header */}
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar name={user.name} hue={user.avatarHue} src={user.photoUrl} size="md" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-text">{user.name}</span>
              <span className="block truncate text-sm text-text-muted">{user.email}</span>
            </span>
          </div>

          <MenuDivider />

          <MenuItem
            icon="gear"
            label="Settings"
            onClick={() => router.push("/settings")}
            trailing={
              <kbd className="rounded-[5px] border border-border bg-canvas px-1.5 py-0.5 text-[12px] font-medium text-text-muted">
                ⌘,
              </kbd>
            }
          />
          <MenuItem
            icon="paint-roller"
            label="Design system"
            onClick={() => router.push("/design-system")}
            trailing={<Badge variant="info">New</Badge>}
          />
          <MenuItem
            icon="person-circle"
            label="Appearance"
            onClick={() => {}}
            trailing={<span className="text-[13px] font-medium text-text-muted">Light</span>}
          />

          <MenuDivider />

          <MenuItem
            icon="message"
            label="Get help"
            onClick={() => {
              window.location.href = "mailto:support@liminal.health";
            }}
            trailing={<Icon name="chevron-right" size={16} className="text-text-muted" />}
          />

          <MenuDivider />

          <MenuItem icon="log-out" label="Sign out" onClick={signOut} danger />
        </DropdownMenu>
      </div>
    </aside>
  );
}

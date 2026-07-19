"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, CountBadge } from "@/components/ui/badge";
import { DropdownMenu, MenuDivider, MenuItem } from "@/components/ui/dropdown-menu";
import { Icon, type IconName } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { Tooltip } from "@/components/ui/tooltip";
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

/** A labeled, collapsible group of nav items (the Fathom sectioned pattern).
    Rendered expanded in the full sidebar and the mobile sheet; in the collapsed
    icon rail it becomes a single icon that links to its first child. */
export interface SidebarNavGroup {
  label: string;
  icon: IconName;
  children: SidebarNavItem[];
}

export type SidebarEntry = SidebarNavItem | SidebarNavGroup;

export function Sidebar({
  items,
  user,
  homeHref = "/",
  sheet = false,
  onNavigate,
  className = "",
}: {
  items: SidebarEntry[];
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

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  // Appearance — one preference shared with the marketing site (`mkt-theme`);
  // the `dark` class on <html> drives the `:root.dark` token block in
  // globals.css. Applied on mount so a stored preference survives full loads.
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const isDark = localStorage.getItem("mkt-theme") === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("mkt-theme", next ? "dark" : "light");
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
          <Link href={homeHref} aria-label="Leuk home" onClick={onNavigate}>
            <Logo variant="onNavy" size="sm" />
          </Link>
        )}
        {!sheet && (
          <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-field text-sidebar-text transition-colors hover:bg-sidebar-active hover:text-white"
            >
              <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={18} />
            </button>
          </Tooltip>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5">
        {items.map((item) => {
          if ("children" in item) {
            return <NavGroup key={item.label} group={item} collapsed={collapsed} onNavigate={onNavigate} />;
          }
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <div key={item.href}>
              {withTip(
                item.label,
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-label={collapsed ? item.label : undefined}
                  className={`flex w-full items-center gap-3 rounded-field px-2.5 py-2.5 text-[15px] font-medium transition-colors ${
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
                </Link>,
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-active p-3">
        {withTip(
          user.name,
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
          {user.email === "brendan@liminal.demo" && (
            <MenuItem icon="grid" label="Data" onClick={() => router.push("/admin/data")} />
          )}
          <MenuItem
            icon={dark ? "sun" : "moon"}
            label="Appearance"
            onClick={toggleTheme}
            trailing={<span className="text-[13px] font-medium text-text-muted">{dark ? "Dark" : "Light"}</span>}
          />

          <MenuDivider />

          <MenuItem
            icon="message"
            label="Help"
            onClick={() => {
              window.location.href = "mailto:support@liminal.health";
            }}
            trailing={<Icon name="chevron-right" size={16} className="text-text-muted" />}
          />

          <MenuDivider />

          <MenuItem icon="log-out" label="Sign out" onClick={signOut} danger />
        </DropdownMenu>,
        )}
      </div>
    </aside>
  );
}

// A collapsible sidebar section: a header row (icon + label + chevron) that
// toggles a list of indented child links. Child active-state is an exact path
// match so a nested route (e.g. /workspace/data-dictionary) lights only its own
// item, not the "/workspace" sibling. In the collapsed rail there's no room to
// nest, so the group folds to a single icon linking to its first child.
function NavGroup({
  group,
  collapsed,
  onNavigate,
}: {
  group: SidebarNavGroup;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isChildActive = (href: string) => pathname === href;
  const containsActive = group.children.some((c) => isChildActive(c.href));
  const [open, setOpen] = useState(containsActive);
  // Following a link into the family (client-side nav) re-opens the section.
  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  if (collapsed) {
    const first = group.children[0];
    return (
      <Tooltip label={group.label} placement="right" className="w-full">
        <Link
          href={first.href}
          onClick={onNavigate}
          aria-label={group.label}
          className={`flex w-full items-center justify-center rounded-field px-2.5 py-2.5 transition-colors ${
            containsActive ? "bg-sidebar-active text-white" : "text-sidebar-text hover:bg-sidebar-active/60 hover:text-white"
          }`}
        >
          <Icon name={group.icon} className="shrink-0" />
        </Link>
      </Tooltip>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-field px-2.5 py-2.5 text-[15px] font-medium transition-colors hover:bg-sidebar-active/60 hover:text-white ${
          containsActive ? "text-white" : "text-sidebar-text"
        }`}
      >
        <Icon name={group.icon} className="shrink-0" />
        <span className="flex-1 truncate text-left">{group.label}</span>
        <Icon name={open ? "chevron-down" : "chevron-right"} size={16} className="shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="mb-1 ml-[22px] mt-0.5 space-y-0.5 border-l border-sidebar-active/70 pl-1.5">
          {group.children.map((child) => {
            const active = isChildActive(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-field px-2.5 py-2 text-[14px] font-medium transition-colors ${
                  active ? "bg-sidebar-active text-white" : "text-sidebar-text hover:bg-sidebar-active/60 hover:text-white"
                }`}
              >
                <Icon name={child.icon} size={16} className="shrink-0" />
                <span className="flex-1 truncate">{child.label}</span>
                {child.count !== undefined && <CountBadge count={child.count} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AccountMenu } from "@/components/shell/account-menu";
import { CountBadge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { Tooltip } from "@/components/ui/tooltip";
import type { SessionUser } from "@/lib/auth";

// Catalog `Sidebar` — the warm-paper column (part of the app L-frame with the
// TopBar). Logo + collapse chevron; a Fathom-style categorized nav (a headerless
// top group, then collapsible small-caps sections whose children sit against a
// left hairline rail); the account chip at the bottom. Active row = a white
// rounded pill with a teal left-accent bar. Collapses to an icon-only rail.

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: IconName;
  count?: number;
}

/** A nav section. The first (headerless) section is the always-open top group;
    the rest render a small-caps header + icon + collapse chevron. */
export interface SidebarNavSection {
  header?: string;
  icon?: IconName;
  items: SidebarNavItem[];
}

const SECTIONS_KEY = "leuk-nav-sections";

export function Sidebar({
  sections,
  user,
  homeHref = "/",
  sheet = false,
  onNavigate,
  className = "",
}: {
  sections: SidebarNavSection[];
  user: SessionUser;
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

  // Section open/closed state, remembered in localStorage (sections default open).
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setClosed(JSON.parse(localStorage.getItem(SECTIONS_KEY) || "{}"));
    } catch {
      /* first run / private mode — everything stays open */
    }
  }, []);
  const isOpen = (header: string) => closed[header] !== true;
  const toggleSection = (header: string) =>
    setClosed((prev) => {
      const next = { ...prev, [header]: !prev[header] };
      try {
        localStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  // Longest-prefix wins so a parent route doesn't stay lit on a child; matched
  // across every item in every section.
  const matchLen = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? href.length : -1);
  const activeLen = Math.max(-1, ...sections.flatMap((s) => s.items.map((i) => matchLen(i.href))));
  const isActive = (href: string) => activeLen >= 0 && matchLen(href) === activeLen;

  // Icon-only rail → every control gets the Tooltip chip in place of the native title.
  const withTip = (label: string, node: ReactNode) =>
    collapsed ? (
      <Tooltip label={label} placement="right" className="w-full">
        {node}
      </Tooltip>
    ) : (
      node
    );

  const navLink = (item: SidebarNavItem) => {
    const active = isActive(item.href);
    return withTip(
      item.label,
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-label={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={`group relative flex w-full items-center gap-3 rounded-field px-2.5 py-2 text-[15px] font-medium transition-colors ${
          collapsed ? "justify-center" : ""
        } ${
          active
            ? "bg-surface text-text shadow-sm"
            : "text-text-body hover:bg-surface hover:text-text hover:shadow-sm"
        }`}
      >
        <Icon
          name={item.icon}
          className={`shrink-0 transition-colors ${
            active ? "fill-primary-wash text-text" : "text-text-body group-hover:fill-primary-wash group-hover:text-text"
          }`}
        />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.count !== undefined && <CountBadge count={item.count} />}
          </>
        )}
      </Link>,
    );
  };

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
              className="inline-flex h-8 w-8 items-center justify-center rounded-field text-text-body transition-colors hover:bg-page-edge/60 hover:text-text"
            >
              <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={18} />
            </button>
          </Tooltip>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section, si) => {
          // Collapsed rail: no headers/rails — just icons, with a hairline
          // separator before each titled section so the groups still read.
          if (collapsed) {
            return (
              <div key={section.header ?? "top"} className={si > 0 && section.header ? "mt-1.5 border-t border-page-edge pt-1.5" : ""}>
                {section.items.map((item) => (
                  <div key={item.href}>{navLink(item)}</div>
                ))}
              </div>
            );
          }
          // Headerless top group.
          if (!section.header) {
            return (
              <div key="top" className="space-y-0.5">
                {section.items.map((item) => (
                  <div key={item.href}>{navLink(item)}</div>
                ))}
              </div>
            );
          }
          const open = isOpen(section.header);
          return (
            <div key={section.header} className="pt-3">
              <button
                type="button"
                onClick={() => toggleSection(section.header!)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 rounded-field px-2.5 py-1.5 text-text-muted transition-colors hover:text-text-body"
              >
                {section.icon && <Icon name={section.icon} size={14} className="shrink-0" />}
                <span className="flex-1 truncate text-left text-[11px] font-semibold uppercase tracking-wider">{section.header}</span>
                <Icon name={open ? "chevron-down" : "chevron-right"} size={14} className="shrink-0" />
              </button>
              {open && (
                <div className="ml-[18px] mt-0.5 space-y-0.5 border-l border-page-edge pl-2">
                  {section.items.map((item) => (
                    <div key={item.href}>{navLink(item)}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-page-edge p-3">
        <AccountMenu user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}

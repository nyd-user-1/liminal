"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icons";

// Catalog `Tabs` — underline tabs. Active = solid teal fill, white text,
// rounded top corners (the ghost-hover shape, committed). On hover a tab
// gets a ghost-button wash and a muted-teal rail slides to it. Href tabs
// (routes) or controlled (active + onChange). `overflow` tucks extra tabs
// behind a "View More" dropdown at the end of the rail.

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  href?: string;
}

const tabCls = (isActive: boolean) =>
  `relative z-10 -mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 pb-2.5 pt-1.5 text-[15px] font-medium transition-colors ${
    isActive
      ? "border-primary bg-primary text-white"
      : "border-transparent text-text-body hover:bg-primary-wash/40 hover:text-text"
  }`;

export function Tabs({
  items,
  active,
  onChange,
  overflow,
  overflowLabel = "View More",
  className = "",
}: {
  items: TabItem[];
  active?: string;
  onChange?: (key: string) => void;
  overflow?: TabItem[];
  overflowLabel?: string;
  className?: string;
}) {
  const pathname = usePathname();
  // Position (relative to the rail container) of the currently-hovered tab.
  const [rail, setRail] = useState<{ left: number; width: number } | null>(null);
  const onEnter = (e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    setRail({ left: el.offsetLeft, width: el.offsetWidth });
  };
  const overflowActive = overflow?.some((t) => t.key === active) ?? false;

  return (
    <div
      className={`relative flex gap-1 border-b border-border ${className}`}
      role="tablist"
      onMouseLeave={() => setRail(null)}
    >
      {items.map((t) => {
        const isActive = t.href ? pathname === t.href : t.key === active;
        const cls = tabCls(isActive);
        const inner = (
          <>
            {t.label}
            {t.count !== undefined && (
              <span
                className={`rounded-full px-1.5 text-[13px] ${
                  isActive ? "bg-white/25 text-white" : "bg-canvas text-text-muted"
                }`}
              >
                {t.count}
              </span>
            )}
          </>
        );
        return t.href ? (
          <Link key={t.key} href={t.href} role="tab" aria-selected={isActive} className={cls} onMouseEnter={onEnter}>
            {inner}
          </Link>
        ) : (
          <button key={t.key} role="tab" aria-selected={isActive} onClick={() => onChange?.(t.key)} className={cls} onMouseEnter={onEnter}>
            {inner}
          </button>
        );
      })}
      {overflow && overflow.length > 0 && (
        <DropdownMenu
          label="More sections"
          align="left"
          triggerClassName={tabCls(overflowActive)}
          trigger={
            <span className="inline-flex items-center gap-1">
              {overflowLabel}
              <Icon name="chevron-down" size={16} />
            </span>
          }
        >
          {overflow.map((t) => (
            <MenuItem key={t.key} label={t.label} selected={t.key === active} onClick={() => onChange?.(t.key)} />
          ))}
        </DropdownMenu>
      )}
      {rail && (
        <span
          className="pointer-events-none absolute bottom-0 z-0 h-0.5 rounded-full bg-primary/40 transition-all duration-200 ease-out"
          style={{ left: rail.left, width: rail.width }}
          aria-hidden
        />
      )}
    </div>
  );
}

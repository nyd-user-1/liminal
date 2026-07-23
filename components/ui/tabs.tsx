"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icons";

// Catalog `Tabs` — underline tabs. Active = primary text + a full-teal underline.
// On hover a tab gets a ghost-button wash and a muted-teal rail slides to it;
// the selected tab keeps its full-teal underline. Href tabs (routes) or
// controlled (active + onChange). `overflow` tucks extra tabs behind a
// "View More" dropdown at the end of the rail.
//
// `slideActive` upgrades the static active underline to a single teal rail that
// *slides* between tabs on selection (the nav's rail-slider feel) and previews
// the hovered tab. Opt-in so existing tab bars keep their instant underline.

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  href?: string;
  /** Render a small × after the label (pairs with the Tabs `onClose` prop) —
      for tabs that represent open records rather than fixed sections. */
  closable?: boolean;
}

const tabCls = (isActive: boolean, slideActive: boolean) =>
  `relative z-10 -mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 pb-2.5 pt-1.5 text-[15px] font-medium outline-none transition-colors focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-primary/40 ${
    isActive
      ? `${slideActive ? "border-transparent" : "border-primary"} text-primary`
      : "border-transparent text-text-body hover:bg-primary-wash/40 hover:text-text"
  }`;

export function Tabs({
  items,
  active,
  onChange,
  onClose,
  overflow,
  overflowLabel = "View More",
  slideActive = false,
  trailing,
  className = "",
}: {
  items: TabItem[];
  active?: string;
  onChange?: (key: string) => void;
  /** Close handler for `closable` items — clicking the × fires this instead
      of selecting the tab. */
  onClose?: (key: string) => void;
  overflow?: TabItem[];
  overflowLabel?: string;
  /** Slide the active underline between tabs (nav rail-slider) instead of
      jumping. Best for controlled (non-route) tab bars. */
  slideActive?: boolean;
  /** Right-aligned content on the rail — the page's "+ New" action lives here
      (canonical home since the TopBar strip retired, 2026-07-23). */
  trailing?: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  // Position (relative to the rail container) of the currently-hovered tab.
  const [rail, setRail] = useState<{ left: number; width: number } | null>(null);
  // Resting position of the underline under the active tab (slideActive only).
  const [activeRail, setActiveRail] = useState<{ left: number; width: number } | null>(null);
  const tabEls = useRef<Record<string, HTMLElement | null>>({});
  const onEnter = (e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    setRail({ left: el.offsetLeft, width: el.offsetWidth });
  };
  const isActiveTab = (t: TabItem) => (t.href ? pathname === t.href : t.key === active);
  const activeKey = items.find(isActiveTab)?.key ?? null;
  const overflowActive = overflow?.some((t) => t.key === active) ?? false;

  // Measure the active tab so the rail rests under it; re-measure on selection
  // change and on resize. (After-paint measure means a one-frame settle on
  // mount, then every subsequent selection animates via `transition-all`.)
  useEffect(() => {
    if (!slideActive) return;
    const measure = () => {
      const el = activeKey ? tabEls.current[activeKey] : null;
      setActiveRail(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [slideActive, activeKey]);

  // Hover preview wins; otherwise rest under the active tab (slideActive only).
  const shownRail = rail ?? (slideActive ? activeRail : null);

  return (
    <div
      className={`relative flex gap-1 border-b border-border ${className}`}
      role="tablist"
      onMouseLeave={() => setRail(null)}
    >
      {items.map((t) => {
        const isActive = isActiveTab(t);
        // Closable tabs represent open records — they wear the hover wash
        // permanently so they read as windows, not sections.
        const cls = `${tabCls(isActive, slideActive)}${t.closable ? " bg-primary-wash/40" : ""}`;
        const setRef = (el: HTMLElement | null) => {
          tabEls.current[t.key] = el;
        };
        const inner = (
          <>
            {t.label}
            {t.count !== undefined && (
              <span
                className={`rounded-full bg-canvas px-1.5 text-[13px] tabular-nums ${
                  isActive ? "text-primary" : "text-text-muted"
                }`}
              >
                {t.count.toLocaleString("en-US")}
              </span>
            )}
            {t.closable && onClose && (
              <span
                role="button"
                aria-label={`Close ${t.label}`}
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onClose(t.key);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onClose(t.key);
                  }
                }}
                className="-mr-1 ml-0.5 rounded p-0.5 text-text-muted transition-colors hover:bg-primary-wash hover:text-text"
              >
                <Icon name="x" size={13} />
              </span>
            )}
          </>
        );
        return t.href ? (
          <Link
            key={t.key}
            ref={setRef}
            href={t.href}
            role="tab"
            aria-selected={isActive}
            className={cls}
            onMouseEnter={onEnter}
          >
            {inner}
          </Link>
        ) : (
          <button
            key={t.key}
            ref={setRef}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(t.key)}
            className={cls}
            onMouseEnter={onEnter}
          >
            {inner}
          </button>
        );
      })}
      {overflow && overflow.length > 0 && (
        <DropdownMenu
          label="More sections"
          align="left"
          triggerClassName={tabCls(overflowActive, slideActive)}
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
      {trailing && <div className="ml-auto flex items-center gap-2 pb-1.5">{trailing}</div>}
      {shownRail && (
        <span
          className={`pointer-events-none absolute bottom-0 z-0 h-0.5 rounded-full transition-all duration-200 ease-out ${
            slideActive ? "bg-primary" : "bg-primary/40"
          }`}
          style={{ left: shownRail.left, width: shownRail.width }}
          aria-hidden
        />
      )}
    </div>
  );
}

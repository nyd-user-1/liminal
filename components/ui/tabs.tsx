"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Catalog `Tabs` — underline tabs. Active = primary text + 2px primary
// bottom border. Href tabs (routes) or controlled (active + onChange).

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  href?: string;
}

export function Tabs({
  items,
  active,
  onChange,
  className = "",
}: {
  items: TabItem[];
  active?: string;
  onChange?: (key: string) => void;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <div className={`flex gap-6 border-b border-border ${className}`} role="tablist">
      {items.map((t) => {
        const isActive = t.href ? pathname === t.href : t.key === active;
        const cls = `relative -mb-px inline-flex items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-[15px] font-medium transition-colors ${
          isActive ? "border-primary text-primary" : "border-transparent text-text-body hover:text-text"
        }`;
        const inner = (
          <>
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-full bg-canvas px-1.5 text-[13px] text-text-muted">{t.count}</span>
            )}
          </>
        );
        return t.href ? (
          <Link key={t.key} href={t.href} role="tab" aria-selected={isActive} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={t.key} role="tab" aria-selected={isActive} onClick={() => onChange?.(t.key)} className={cls}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

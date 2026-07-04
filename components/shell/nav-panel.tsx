"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSquare, type IconName } from "@/components/ui/icons";

// Catalog `NavPanel` — the Settings secondary nav: white panel beside the
// Sidebar; section label + rows (icon square + title + muted subtitle),
// optional detached destructive item at the bottom.

export interface NavPanelItem {
  href: string;
  icon: IconName;
  title: string;
  subtitle?: string;
}

export function NavPanel({
  label,
  items,
  footerItem,
  className = "",
}: {
  label: string;
  items: NavPanelItem[];
  footerItem?: NavPanelItem; // e.g. Trash
  className?: string;
}) {
  const pathname = usePathname();

  const row = (item: NavPanelItem, danger?: boolean) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-field px-2.5 py-2 transition-colors ${
          active ? "bg-teal-100" : "hover:bg-[#F3F4F6]"
        }`}
      >
        <IconSquare name={item.icon} className={danger ? "text-danger" : ""} />
        <span className="min-w-0">
          <span className={`block truncate text-[15px] font-semibold ${danger ? "text-danger" : "text-text"}`}>
            {item.title}
          </span>
          {item.subtitle && <span className="block truncate text-sm text-text-muted">{item.subtitle}</span>}
        </span>
      </Link>
    );
  };

  return (
    <nav
      className={`flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface p-3 ${className}`}
      aria-label={label}
    >
      <div className="px-2.5 pb-2 pt-1 text-[13px] font-semibold text-text-muted">{label}</div>
      <div className="flex-1 space-y-0.5 overflow-y-auto">{items.map((i) => row(i))}</div>
      {footerItem && <div className="border-t border-border pt-2">{row(footerItem, true)}</div>}
    </nav>
  );
}

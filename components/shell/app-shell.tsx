import type { ReactNode } from "react";
import { Sidebar, type SidebarNavItem } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";
import type { SessionUser } from "@/lib/auth";

// Catalog `AppShell` — Sidebar + main column (TopBar + canvas content).
// Two variants: `workspace` (practitioner/admin) and `portal` (client).
// Server component; layouts pass the session user down.

const WORKSPACE_NAV: SidebarNavItem[] = [
  { label: "Calendar", href: "/calendar", icon: "calendar" },
  { label: "Inbox", href: "/inbox", icon: "inbox" },
  { label: "Clients", href: "/clients", icon: "users" },
  { label: "Directory", href: "/directory", icon: "globe" },
  { label: "Billing", href: "/billing", icon: "dollar" },
  { label: "Library", href: "/templates", icon: "clipboard" },
  { label: "Settings", href: "/settings", icon: "gear" },
  { label: "Design system", href: "/design-system", icon: "paint-roller" },
];

const PORTAL_NAV: SidebarNavItem[] = [
  { label: "Home", href: "/portal", icon: "grid" },
  { label: "Appointments", href: "/portal/appointments", icon: "calendar-check" },
  { label: "Records", href: "/portal/records", icon: "file-text" },
  { label: "Resources", href: "/portal/resources", icon: "globe" },
  { label: "Forms", href: "/portal/forms", icon: "clipboard" },
  { label: "Invoices", href: "/portal/invoices", icon: "credit-card" },
  { label: "Messages", href: "/portal/messages", icon: "message" },
];

export function AppShell({
  variant,
  user,
  title,
  topBarActions,
  counts,
  children,
}: {
  variant: "workspace" | "portal";
  user: SessionUser;
  title?: string;
  topBarActions?: ReactNode;
  /** Optional per-href sidebar count badges, e.g. { "/inbox": 3 }. */
  counts?: Record<string, number>;
  children: ReactNode;
}) {
  const nav = (variant === "workspace" ? WORKSPACE_NAV : PORTAL_NAV).map((item) =>
    counts?.[item.href] !== undefined ? { ...item, count: counts[item.href] } : item,
  );
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar items={nav} user={user} homeHref={variant === "portal" ? "/portal" : "/calendar"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} user={user} actions={topBarActions} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

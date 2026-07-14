import type { ReactNode } from "react";
import { MobileNav } from "@/components/shell/mobile-nav";
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
  { label: "Rates", href: "/rates", icon: "activity" },
  { label: "Organizations", href: "/orgs", icon: "id-card" },
  { label: "Plans", href: "/plans", icon: "credit-card" },
  { label: "Recruiting", href: "/recruiting", icon: "users-round" },
  { label: "Library", href: "/library", icon: "clipboard" },
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
  { label: "Profile", href: "/portal/profile", icon: "person-circle" },
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
  const homeHref = variant === "portal" ? "/portal" : "/calendar";
  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <Sidebar className="max-md:hidden" items={nav} user={user} homeHref={homeHref} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={title}
          user={user}
          actions={topBarActions}
          leading={<MobileNav items={nav} user={user} homeHref={homeHref} />}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar, type SidebarNavItem } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";
import type { SessionUser } from "@/lib/auth";

// Catalog `AppShell` — Sidebar + main column (TopBar + canvas content).
// Two variants: `workspace` (practitioner/admin) and `portal` (client).
// Server component; layouts pass the session user down.

const WORKSPACE_NAV: SidebarNavItem[] = [
  // The front door: today's caseload for everyone, plus the platform
  // inventory for the founder. First item because it's where a day starts.
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  // The composable board. Sits beside Dashboard for now — Dashboard is the
  // fixed page, Analytics is the one you build yourself.
  { label: "Analytics", href: "/analytics", icon: "columns-3" },
  { label: "Calendar", href: "/calendar", icon: "calendar" },
  { label: "Inbox", href: "/inbox", icon: "inbox" },
  { label: "Clients", href: "/clients", icon: "users" },
  // Photon e-prescribing, grouped after Clients: the Rx you wrote, the pharmacy
  // orders they became, and the formulary that feeds the prescribe flow.
  { label: "Prescriptions", href: "/prescriptions", icon: "pill-bottle" },
  { label: "Orders", href: "/orders", icon: "send" },
  { label: "Catalog", href: "/catalog", icon: "grid" },
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

// Home is the patient's own record (the /clients/[id] shell, read-only), so
// Medications / Records / Invoices each exist twice: once as a tab of that
// record and once as their own destination here. That duplication is
// deliberate — the record is the whole picture, the nav items are the direct
// route to one part of it.
const PORTAL_NAV: SidebarNavItem[] = [
  { label: "Home", href: "/portal", icon: "id-card" },
  { label: "Appointments", href: "/portal/appointments", icon: "calendar-check" },
  { label: "Medications", href: "/portal/medications", icon: "pill-bottle" },
  { label: "Records", href: "/portal/records", icon: "file-text" },
  { label: "Resources", href: "/portal/resources", icon: "globe" },
  { label: "Forms", href: "/portal/forms", icon: "clipboard" },
  { label: "Invoices", href: "/portal/invoices", icon: "credit-card" },
  { label: "Messages", href: "/portal/messages", icon: "message" },
  { label: "Profile", href: "/portal/profile", icon: "person-circle" },
  { label: "Dashboard", href: "/portal/dashboard", icon: "grid" },
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

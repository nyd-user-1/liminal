import type { ReactNode } from "react";
import { MobileNav } from "@/components/shell/mobile-nav";
import { CommandPalette } from "@/components/search/command-palette";
import { ContentHeader } from "@/components/shell/content-header";
import { Sidebar, type SidebarNavSection } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";
import type { SessionUser } from "@/lib/auth";

// Catalog `AppShell` — Sidebar + main column (TopBar utility bar + content).
// Two variants: `workspace` (practitioner/admin) and `portal` (client).
// Server component; layouts pass the session user down.
//
// Shell chrome: the warm-paper Sidebar (left) + warm-paper TopBar (top) read as
// one L-frame. The white content panel (`main`, bg-surface) tucks into that
// junction with a single rounded top-left corner (md+); the paper root shows
// through that corner. The route H1 sits at the top of the content surface
// (ContentHeader), not in the TopBar — the TopBar is a utility bar (context
// pill / search / bell). The account chip lives at the bottom of the Sidebar.

// The practitioner nav, categorized (Fathom pattern): a headerless top group,
// then collapsible sections. Workspace is a single top item — its sub-views
// (Analytics / Dashboard / Data dictionary / Docs) are in-content tabs, not
// sidebar children.
const WORKSPACE_NAV: SidebarNavSection[] = [
  {
    items: [
      { label: "Chat", href: "/chat", icon: "message" },
      { label: "Workspace", href: "/workspace", icon: "grid" },
      { label: "Calendar", href: "/calendar", icon: "calendar" },
      { label: "Inbox", href: "/inbox", icon: "inbox" },
      { label: "Clients", href: "/clients", icon: "users" },
    ],
  },
  {
    header: "Practice",
    icon: "hand-heart",
    items: [
      { label: "Prescriptions", href: "/prescriptions", icon: "pill-bottle" },
      { label: "Orders", href: "/orders", icon: "send" },
      { label: "Billing", href: "/billing", icon: "dollar" },
      { label: "Earnings", href: "/earnings", icon: "credit-card" },
      { label: "Catalog", href: "/catalog", icon: "grid" },
      { label: "Library", href: "/library", icon: "clipboard" },
    ],
  },
  {
    header: "Intelligence",
    icon: "columns-3",
    items: [
      { label: "Rates", href: "/rates", icon: "activity" },
      { label: "Directory", href: "/directory", icon: "globe" },
      { label: "Organizations", href: "/orgs", icon: "id-card" },
      { label: "Networks", href: "/networks", icon: "link" },
      { label: "Plans", href: "/plans", icon: "credit-card" },
      { label: "Recruiting", href: "/recruiting", icon: "users-round" },
    ],
  },
  {
    header: "System",
    icon: "monitor-check",
    items: [
      { label: "Monitor", href: "/monitor", icon: "activity" },
      { label: "Settings", href: "/settings", icon: "gear" },
      { label: "Design system", href: "/design-system", icon: "paint-roller" },
    ],
  },
];

// Home is the patient's own record (the /clients/[id] shell, read-only), so
// Medications / Records / Invoices each exist twice: once as a tab of that
// record and once as their own destination here. One flat, headerless group.
const PORTAL_NAV: SidebarNavSection[] = [
  {
    items: [
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
    ],
  },
];

export function AppShell({
  variant,
  user,
  counts,
  children,
}: {
  variant: "workspace" | "portal";
  user: SessionUser;
  /** Optional per-href sidebar count badges, e.g. { "/inbox": 3 }. */
  counts?: Record<string, number>;
  children: ReactNode;
}) {
  const base = variant === "workspace" ? WORKSPACE_NAV : PORTAL_NAV;
  const sections: SidebarNavSection[] = counts
    ? base.map((s) => ({
        ...s,
        items: s.items.map((item) => (counts[item.href] !== undefined ? { ...item, count: counts[item.href] } : item)),
      }))
    : base;
  const homeHref = variant === "portal" ? "/portal" : "/calendar";
  return (
    <div className="flex h-dvh overflow-hidden bg-page">
      {/* ⌘K search. Both variants have one; they differ only in the endpoint
          behind them. The portal's is scoped server-side to the signed-in
          patient's own record — it cannot return another client, or anything
          from the directory/rates side of the app. */}
      <CommandPalette scope={variant === "portal" ? "portal" : "workspace"} />
      <Sidebar className="max-md:hidden" sections={sections} user={user} homeHref={homeHref} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar leading={<MobileNav sections={sections} user={user} homeHref={homeHref} />} />
        {/* The inset content panel: white surface, rounded only where it meets
            the sidebar/topbar junction (md+); the paper root shows through that
            corner. The scrollbar is hidden (scrolling still works). */}
        <main className="flex-1 overflow-y-auto border border-[#d3d5db] bg-surface p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] [scrollbar-width:none] md:rounded-tl-2xl md:p-6 md:pb-6 [&::-webkit-scrollbar]:hidden">
          <ContentHeader className="mb-6" />
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { IconName } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { TOPBAR_ACTIONS_ID } from "@/components/shell/topbar-slot";
import type { SessionUser } from "@/lib/auth";

// Catalog `TopBar` — white strip: page icon + H1 inline-left (route-derived,
// SSR-safe), right cluster = page actions (via TopBarActions portal, sized
// sm). Account/sign-out live in the sidebar's UserChip menu, not here.

// Longest-prefix wins: order specific → general.
const ROUTE_TITLES: Array<[prefix: string, icon: IconName, title: string]> = [
  ["/calendar", "calendar", "Calendar"],
  ["/inbox", "inbox", "Inbox"],
  ["/clients", "users", "Clients"],
  ["/prescriptions", "pill-bottle", "Prescriptions"],
  ["/orders", "send", "Orders"],
  ["/catalog", "grid", "Catalog"],
  ["/directory", "globe", "Directory"],
  ["/billing", "dollar", "Billing"],
  ["/rates", "activity", "Rates"],
  // Soft launch: direct-URL only, no sidebar entry. Sits after /rates but the
  // prefix match is exact-or-"/rates/", so the two never collide.
  ["/published-rates", "dollar", "Published rates"],
  ["/orgs", "id-card", "Organizations"],
  ["/plans", "credit-card", "Plans"],
  ["/recruiting", "users-round", "Recruiting"],
  ["/library", "clipboard", "Library"],
  // Settings is a tabbed section (services/locations/availability) — one constant
  // title, tab bar switches the panel. See app/(app)/settings/layout.tsx.
  ["/settings", "gear", "Settings"],
  ["/design-system", "paint-roller", "Design System"],
  ["/admin/data", "grid", "Data dictionary"],
  ["/portal/dashboard", "grid", "Dashboard"],
  ["/portal/appointments", "calendar-check", "Appointments"],
  ["/portal/medications", "pill-bottle", "Medications"],
  ["/portal/records", "file-text", "Records"],
  ["/portal/resources", "globe", "Resources"],
  ["/portal/forms", "clipboard", "Forms"],
  ["/portal/invoices", "credit-card", "Invoices"],
  ["/portal/messages", "message", "Messages"],
  ["/portal/profile", "person-circle", "Profile"],
];

// /portal is the patient's own record and carries its own entity header (the
// name as H1, the client-record exception to the one-H1-in-the-TopBar rule),
// so the strip names the destination rather than greeting — the greeting moved
// to /portal/dashboard, which renders its own.
function routeTitle(pathname: string): { icon: IconName; title: string } {
  if (pathname === "/portal") return { icon: "id-card", title: "Home" };
  const hit = ROUTE_TITLES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return hit ? { icon: hit[1], title: hit[2] } : { icon: "grid", title: "Leuk" };
}

export function TopBar({
  title,
  user,
  actions,
  leading,
}: {
  /** Optional override; defaults to the route-derived title. */
  title?: string;
  user: SessionUser;
  actions?: ReactNode;
  /** Slot before the title — the mobile hamburger. */
  leading?: ReactNode;
}) {
  const pathname = usePathname();
  const derived = routeTitle(pathname);

  return (
    <header className="flex h-[calc(4rem_+_env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b border-border bg-surface px-3 pt-[env(safe-area-inset-top)] md:gap-3 md:px-6">
      {leading}
      <div className="min-w-0 flex-1">
        <PageHeader title={title ?? derived.title} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div id={TOPBAR_ACTIONS_ID} className="flex items-center gap-2" />
        {actions}
      </div>
    </header>
  );
}

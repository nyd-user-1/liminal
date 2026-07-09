"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, MenuDivider, MenuItem } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import type { IconName } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { UserChip } from "@/components/ui/user-chip";
import { TOPBAR_ACTIONS_ID } from "@/components/shell/topbar-slot";
import type { SessionUser } from "@/lib/auth";

// Catalog `TopBar` — white strip: page icon + H1 inline-left (route-derived,
// SSR-safe), right cluster = page actions (via TopBarActions portal) + bell +
// UserChip → avatar menu. One canonical title everywhere — no per-page drift.

// Longest-prefix wins: order specific → general.
const ROUTE_TITLES: Array<[prefix: string, icon: IconName, title: string]> = [
  ["/calendar", "calendar", "Calendar"],
  ["/inbox", "inbox", "Inbox"],
  ["/clients", "users", "Clients"],
  ["/directory", "globe", "Directory"],
  ["/billing", "dollar", "Billing"],
  ["/library", "clipboard", "Library"],
  // Settings is a tabbed section (services/locations/availability) — one constant
  // title, tab bar switches the panel. See app/(app)/settings/layout.tsx.
  ["/settings", "gear", "Settings"],
  ["/design-system", "paint-roller", "Design System"],
  ["/portal/appointments", "calendar-check", "Appointments"],
  ["/portal/records", "file-text", "Records"],
  ["/portal/resources", "globe", "Resources"],
  ["/portal/forms", "clipboard", "Forms"],
  ["/portal/invoices", "credit-card", "Invoices"],
  ["/portal/messages", "message", "Messages"],
  ["/portal/profile", "person-circle", "Profile"],
];

function routeTitle(pathname: string, user: SessionUser): { icon: IconName; title: string } {
  if (pathname === "/portal") return { icon: "grid", title: `Welcome back, ${user.name.split(" ")[0]}` };
  const hit = ROUTE_TITLES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return hit ? { icon: hit[1], title: hit[2] } : { icon: "grid", title: "Liminal" };
}

export function TopBar({
  title,
  user,
  actions,
}: {
  /** Optional override; defaults to the route-derived title. */
  title?: string;
  user: SessionUser;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const derived = routeTitle(pathname, user);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-6">
      <PageHeader title={title ?? derived.title} />
      <div className="ml-auto flex items-center gap-2">
        <div id={TOPBAR_ACTIONS_ID} className="flex items-center gap-2" />
        {actions}
        <IconButton icon="bell" label="Notifications" />
        <DropdownMenu label="Avatar menu" trigger={<UserChip name={user.name} hue={user.avatarHue} />}>
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar name={user.name} hue={user.avatarHue} size="md" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-text">{user.name}</span>
              <span className="block truncate text-sm text-text-muted">{user.email}</span>
            </span>
          </div>
          <MenuDivider />
          <MenuItem icon="log-out" label="Sign out" onClick={signOut} />
        </DropdownMenu>
      </div>
    </header>
  );
}

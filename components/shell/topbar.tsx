"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, MenuDivider, MenuItem } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { UserChip } from "@/components/ui/user-chip";
import type { SessionUser } from "@/lib/auth";

// Catalog `TopBar` — white strip: optional page title left; right cluster =
// actions slot + bell + UserChip → avatar menu (identity header · Sign out).
// The fuller account menu lives on the sidebar's bottom-left UserChip.

export function TopBar({
  title,
  user,
  actions,
}: {
  title?: string;
  user: SessionUser;
  actions?: ReactNode;
}) {
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-6">
      {title && <h1 className="text-[19px] font-semibold text-text">{title}</h1>}
      <div className="ml-auto flex items-center gap-2">
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

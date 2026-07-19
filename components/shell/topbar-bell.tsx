"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CountBadge, DotBadge } from "@/components/ui/badge";
import { DropdownMenu, MenuDivider, MenuItem, MenuSectionLabel } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icons";
import type { Notification } from "@/lib/repos/notifications";

// The TopBar bell — real at last. Fetches the session user's notifications,
// wears the unread count as a red CountBadge, and opens a DropdownMenu of
// recent items; each click navigates to the notification's href (pipeline
// alerts land on /workspace). Opening the menu IS the read event: the badge
// clears, the per-item dots stay for that viewing, and there is no per-row
// read UI to manage. Producers write rows via lib/repos/notifications.ts.

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function TopBarBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: Notification[]; unread: number };
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      /* the bell is never worth an error surface */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The DropdownMenu owns its open state; this capture handler sees only
  // trigger clicks (the menu itself portals to <body>). Every click refreshes;
  // an unread badge is cleared and persisted as read.
  const onTriggerClick = () => {
    void refresh();
    if (unread > 0) {
      setUnread(0);
      void fetch("/api/notifications", { method: "POST" });
    }
  };

  return (
    <span onClickCapture={onTriggerClick}>
      <DropdownMenu
        label="Notifications"
        width="w-80"
        triggerClassName="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-field text-text-body transition-colors hover:bg-[#F3F4F6]"
        trigger={
          <>
            <Icon name="bell" />
            {unread > 0 && <CountBadge count={unread} variant="danger" className="absolute -right-1 -top-1" />}
          </>
        }
      >
        <MenuSectionLabel>Notifications</MenuSectionLabel>
        {items.length === 0 ? (
          <div className="flex items-center gap-2.5 px-2.5 py-3 text-sm text-text-muted">
            <Icon name="check" size={16} className="text-success" />
            You&apos;re all caught up.
          </div>
        ) : (
          items.map((n) => (
            <MenuItem
              key={n.id}
              label={n.title}
              subtitle={`${n.body ? `${n.body} · ` : ""}${timeAgo(n.createdAt)}`}
              trailing={n.readAt === null ? <DotBadge variant="danger" /> : undefined}
              onClick={() => router.push(n.href ?? "/workspace")}
            />
          ))
        )}
        <MenuDivider />
        <MenuItem icon="activity" label="View sync health" onClick={() => router.push("/workspace")} />
      </DropdownMenu>
    </span>
  );
}

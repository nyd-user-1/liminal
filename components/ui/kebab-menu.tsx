"use client";

import type { ReactNode } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `KebabMenu` — dots trigger opening a DropdownMenu of contextual
// actions. Children = MenuItem rows. `icon` defaults to vertical dots; pass
// "dots-horizontal" for a horizontal ellipsis.

export function KebabMenu({
  label = "More actions",
  align = "right",
  icon = "dots-vertical",
  children,
}: {
  label?: string;
  align?: "left" | "right";
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <DropdownMenu
      label={label}
      align={align}
      trigger={<Icon name={icon} className="text-text-body" />}
      triggerClassName="inline-flex h-9 w-9 items-center justify-center rounded-field transition-colors hover:bg-[#F3F4F6]"
    >
      {children}
    </DropdownMenu>
  );
}

"use client";

import type { ReactNode } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icons";

// Catalog `KebabMenu` — vertical-dots trigger opening a DropdownMenu of
// contextual actions. Children = MenuItem rows.

export function KebabMenu({
  label = "More actions",
  align = "right",
  children,
}: {
  label?: string;
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <DropdownMenu
      label={label}
      align={align}
      trigger={<Icon name="dots-vertical" className="text-text-body" />}
      triggerClassName="inline-flex h-9 w-9 items-center justify-center rounded-field transition-colors hover:bg-[#F3F4F6]"
    >
      {children}
    </DropdownMenu>
  );
}
